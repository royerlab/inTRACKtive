import { useCallback, useEffect, useState } from "react";
import "@/css/app.css";

import { Box, Divider, Drawer } from "@mui/material";

import Scene from "@/components/Scene";
import CellControls from "@/components/CellControls";
import DataControls from "@/components/DataControls";
import PlaybackControls from "@/components/PlaybackControls";

import { usePointCanvas, ActionType } from "@/hooks/usePointCanvas";

import { ViewerState, clearUrlHash } from "@/lib/ViewerState";
import { TrackManager, loadTrackManager } from "@/lib/TrackManager";
import { PointSelectionMode } from "@/lib/PointSelector";
import LeftSidebarWrapper from "./leftSidebar/LeftSidebarWrapper";
import { TimestampOverlay } from "./overlays/TimestampOverlay";
import { ColorMap } from "./overlays/ColorMap";

// Ideally we do this here so that we can use initial values as default values for React state.
const initialViewerState = ViewerState.fromUrlHash(window.location.hash);
console.log("initial viewer state: ", initialViewerState);
clearUrlHash();

const drawerWidth = 256;
const playbackFPS = 16;
const playbackIntervalMs = 1000 / playbackFPS;

export default function App() {
    // TrackManager handles data fetching
    const [trackManager, setTrackManager] = useState<TrackManager | null>(null);
    const numTimes = trackManager?.numTimes ?? 0;
    // TODO: dataUrl can be stored in the TrackManager only
    const [dataUrl, setDataUrl] = useState(initialViewerState.dataUrl);
    const [isLoadingTracks, setIsLoadingTracks] = useState(false);

    // PointCanvas is a Three.js canvas, updated via reducer
    const [canvas, dispatchCanvas, sceneDivRef] = usePointCanvas(initialViewerState);
    const numTracksLoaded = canvas.tracks.size;
    const trackHighlightLength = canvas.maxTime - canvas.minTime;

    // this state is pure React
    const [playing, setPlaying] = useState(false);
    const [isLoadingPoints, setIsLoadingPoints] = useState(false);

    // Manage shareable state that can persist across sessions.
    const copyShareableUrlToClipboard = () => {
        console.log("copy shareable URL to clipboard");
        const state = new ViewerState();
        if (trackManager) {
            state.dataUrl = trackManager.store;
        }
        state.curTime = canvas.curTime;
        state.minTime = canvas.minTime;
        state.maxTime = canvas.maxTime;
        state.maxPointsPerTimepoint = canvas.maxPointsPerTimepoint;
        state.pointBrightness = canvas.pointBrightness;
        state.showTracks = canvas.showTracks;
        state.showTrackHighlights = canvas.showTrackHighlights;
        state.selectedTrackIds = new Array(...canvas.selectedTrackIds);
        state.cameraPosition = canvas.camera.position.clone();
        state.cameraTarget = canvas.controls.target.clone();
        const url = window.location.toString() + state.toUrlHash();
        navigator.clipboard.writeText(url);
    };

    const setStateFromHash = useCallback(() => {
        const state = ViewerState.fromUrlHash(window.location.hash);
        clearUrlHash();
        setDataUrl(state.dataUrl);
        dispatchCanvas({ type: ActionType.INIT_POINTS_GEOMETRY, maxPointsPerTimepoint: state.maxPointsPerTimepoint });
        dispatchCanvas({ type: ActionType.CUR_TIME, curTime: state.curTime });
        dispatchCanvas({ type: ActionType.MIN_MAX_TIME, minTime: state.minTime, maxTime: state.maxTime });
        dispatchCanvas({ type: ActionType.POINT_BRIGHTNESS, brightness: state.pointBrightness });
        dispatchCanvas({ type: ActionType.SHOW_TRACKS, showTracks: state.showTracks });
        dispatchCanvas({ type: ActionType.SHOW_TRACK_HIGHLIGHTS, showTrackHighlights: state.showTrackHighlights });
        dispatchCanvas({
            type: ActionType.CAMERA_PROPERTIES,
            cameraPosition: state.cameraPosition,
            cameraTarget: state.cameraTarget,
        });
        dispatchCanvas({
            type: ActionType.ADD_SELECTED_TRACK_IDS,
            selectedTrackIds: new Set(state.selectedTrackIds),
        });
    }, [dispatchCanvas]);

    // update the state when the hash changes, but only register the listener once
    useEffect(() => {
        window.addEventListener("hashchange", setStateFromHash);
        return () => {
            window.removeEventListener("hashchange", setStateFromHash);
        };
    }, [setStateFromHash]);

    // update the array when the dataUrl changes
    useEffect(() => {
        console.log("load data from %s", dataUrl);
        const trackManager = loadTrackManager(dataUrl);
        // TODO: add clean-up by returning another closure
        trackManager.then((tm: TrackManager | null) => {
            setTrackManager(tm);
            // Defend against the case when a curTime valid for previous data
            // is no longer valid.
            dispatchCanvas({
                type: ActionType.CUR_TIME,
                curTime: (c: number) => {
                    return Math.min(c, (tm?.numTimes ?? numTimes) - 1);
                },
            });
        });
    }, [dispatchCanvas, dataUrl, numTimes]);

    // update the geometry buffers when the array changes
    // TODO: do this in the above useEffect
    useEffect(() => {
        console.debug("effect-trackmanager");
        if (!trackManager) return;
        dispatchCanvas({
            type: ActionType.INIT_POINTS_GEOMETRY,
            maxPointsPerTimepoint: trackManager.maxPointsPerTimepoint,
        });
    }, [dispatchCanvas, trackManager]);

    // update the points when the array or timepoint changes
    useEffect(() => {
        console.debug("effect-curTime");
        // show a loading indicator if the fetch takes longer than 1 frame (avoid flicker)
        const loadingTimeout = setTimeout(() => setIsLoadingPoints(true), playbackIntervalMs);
        let ignore = false;
        // TODO: this is a very basic attempt to prevent stale data
        // in addition, we should debounce the input and verify the data is current
        // before rendering it
        if (trackManager && !ignore) {
            const getPoints = async (time: number) => {
                console.debug("fetch points at time %d", time);
                const data = await trackManager.fetchPointsAtTime(time);
                console.debug("got %d points for time %d", data.length / 3, time);

                if (ignore) {
                    console.debug("IGNORE SET points at time %d", time);
                    return;
                }

                // clearing the timeout prevents the loading indicator from showing at all if the fetch is fast
                clearTimeout(loadingTimeout);
                setIsLoadingPoints(false);
                dispatchCanvas({ type: ActionType.POINTS_POSITIONS, positions: data });
            };
            getPoints(canvas.curTime);
        } else {
            clearTimeout(loadingTimeout);
            setIsLoadingPoints(false);
            console.debug("IGNORE FETCH points at time %d", canvas.curTime);
        }

        // stop playback if there is no data
        if (!trackManager) {
            setPlaying(false);
        }

        return () => {
            clearTimeout(loadingTimeout);
            ignore = true;
        };
    }, [canvas.curTime, dispatchCanvas, trackManager]);

    // This fetches track IDs based on the selected points.
    // While selectedPoints is transient state that we may not want to depend
    // on in the react render loop, we need to do it here because this is the
    // only place that we have access to the TrackManager.
    useEffect(() => {
        console.debug("effect-selectedPoints: ", trackManager, canvas.selectedPoints);
        if (!trackManager) return;

        const pointsID = canvas.points.id;
        const selectedPoints = canvas.selectedPoints;
        const selected = selectedPoints.get(pointsID) || [];

        dispatchCanvas({ type: ActionType.POINT_BRIGHTNESS, brightness: 0.8 });
        dispatchCanvas({ type: ActionType.HIGHLIGHT_POINTS, points: selected });

        if (!selectedPoints || !selectedPoints.has(pointsID)) return;

        // Capture the point ID offset once.
        // TODO: store this at the time of selection to ensure we have the right
        // time point. Or store the point IDs as state instead.
        const pointIdOffset = canvas.curTime * canvas.maxPointsPerTimepoint;

        const updateTrackIds = async () => {
            const selectedTrackIds = new Set<number>();
            const pointIndices = selectedPoints.get(pointsID) || [];
            for (const pointIndex of pointIndices) {
                const pointId = pointIdOffset + pointIndex;
                const trackIds = await trackManager.fetchTrackIDsForPoint(pointId);
                for (const trackId of trackIds) {
                    selectedTrackIds.add(trackId);
                }
            }
            dispatchCanvas({
                type: ActionType.ADD_SELECTED_TRACK_IDS,
                selectedTrackIds: selectedTrackIds,
            });
        };
        updateTrackIds();
    }, [trackManager, dispatchCanvas, canvas.selectedPoints]);

    // This loads tracks based on the selected track IDs.
    // The new set of track IDs should be an entirely new object otherwise
    // the effect dependency will not be detected by react.
    useEffect(() => {
        console.debug("effect-selectedTrackIds: ", trackManager, canvas.selectedTrackIds);
        if (!trackManager) return;
        if (!canvas.selectedTrackIds) return;

        setIsLoadingTracks(true);

        // keep track of which tracks we are adding to avoid duplicate fetching
        const adding = new Set<number>();

        // this fetches the entire lineage for each track
        const updateTracks = async () => {
            console.debug("updateTracks: ", canvas.selectedTrackIds);
            // TODO: points actually only belong to one track, so can get rid of the outer loop
            for (const trackId of canvas.selectedTrackIds) {
                if (canvas.fetchedRootTrackIds.has(trackId)) continue;
                canvas.fetchedRootTrackIds.add(trackId);
                const lineage = await trackManager.fetchLineageForTrack(trackId);
                for (const relatedId of lineage) {
                    if (adding.has(relatedId) || canvas.tracks.has(relatedId)) continue;
                    adding.add(relatedId);
                    const [pos, ids] = await trackManager.fetchPointsForTrack(relatedId);
                    // adding the track *in* the dispatcher creates issues with duplicate fetching
                    // but we refresh so the selected/loaded count is updated
                    canvas.addTrack(relatedId, pos, ids);
                    dispatchCanvas({ type: ActionType.REFRESH });
                }
            }

            setIsLoadingTracks(false);
        };
        updateTracks();
    }, [trackManager, dispatchCanvas, canvas.selectedTrackIds]);

    // playback time points
    // TODO: this is basic and may drop frames
    useEffect(() => {
        console.debug("effect-playback");
        if (playing) {
            const interval = setInterval(() => {
                dispatchCanvas({
                    type: ActionType.CUR_TIME,
                    curTime: (c: number) => {
                        return (c + 1) % numTimes;
                    },
                });
            }, playbackIntervalMs);
            return () => {
                clearInterval(interval);
            };
        }
    }, [dispatchCanvas, numTimes, playing]);

    return (
        <Box sx={{ display: "flex", width: "100%", height: "100%" }}>
            {/* TODO: components *could* go deeper still for organization */}
            <Drawer
                anchor="left"
                variant="permanent"
                sx={{
                    "width": drawerWidth,
                    "flexShrink": 0,
                    "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box" },
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        width: "100%",
                        height: "100%",
                    }}
                >
                    <Box
                        sx={{
                            flexGrow: 0,
                            padding: "1em 1.5em",
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <img src="/zebrahub-favicon-60x60.png" alt="logo" />
                        <Divider orientation="vertical" flexItem />
                        <h2>ZEBRAHUB</h2>
                    </Box>
                    <Box flexGrow={0} padding="2em">
                        <CellControls
                            clearTracks={() => {
                                dispatchCanvas({ type: ActionType.REMOVE_ALL_TRACKS });
                            }}
                            numSelectedCells={numTracksLoaded}
                            trackManager={trackManager}
                            pointBrightness={canvas.pointBrightness}
                            setPointBrightness={(brightness: number) => {
                                dispatchCanvas({ type: ActionType.POINT_BRIGHTNESS, brightness });
                            }}
                            selectionMode={canvas.selector.selectionMode}
                            setSelectionMode={(value: PointSelectionMode) => {
                                dispatchCanvas({ type: ActionType.SELECTION_MODE, selectionMode: value });
                            }}
                        />
                    </Box>
                    <Divider />
                    <Box flexGrow={4} padding="2em">
                        <LeftSidebarWrapper
                            hasTracks={numTracksLoaded > 0}
                            trackManager={trackManager}
                            trackHighlightLength={trackHighlightLength}
                            selectionMode={canvas.selector.selectionMode}
                            showTracks={canvas.showTracks}
                            setShowTracks={(show: boolean) => {
                                dispatchCanvas({ type: ActionType.SHOW_TRACKS, showTracks: show });
                            }}
                            showTrackHighlights={canvas.showTrackHighlights}
                            setShowTrackHighlights={(show: boolean) => {
                                dispatchCanvas({ type: ActionType.SHOW_TRACK_HIGHLIGHTS, showTrackHighlights: show });
                            }}
                            setTrackHighlightLength={(length: number) => {
                                dispatchCanvas({
                                    type: ActionType.MIN_MAX_TIME,
                                    minTime: canvas.curTime - length / 2,
                                    maxTime: canvas.curTime + length / 2,
                                });
                            }}
                        />
                    </Box>
                    <Divider />
                    <Box flexGrow={0} padding="1em">
                        <DataControls
                            dataUrl={dataUrl}
                            initialDataUrl={initialViewerState.dataUrl}
                            setDataUrl={setDataUrl}
                            copyShareableUrlToClipboard={copyShareableUrlToClipboard}
                            validTrackManager={trackManager !== null}
                        />
                    </Box>
                </Box>
            </Drawer>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                }}
            >
                <Scene
                    ref={sceneDivRef}
                    isLoading={isLoadingPoints || isLoadingTracks}
                    initialCameraPosition={initialViewerState.cameraPosition}
                    initialCameraTarget={initialViewerState.cameraTarget}
                />
                <Box flexGrow={0} padding="1em">
                    <TimestampOverlay timestamp={canvas.curTime} />
                    <ColorMap />
                    <PlaybackControls
                        enabled={true}
                        autoRotate={canvas.controls.autoRotate}
                        playing={playing}
                        curTime={canvas.curTime}
                        numTimes={numTimes}
                        setAutoRotate={(autoRotate: boolean) => {
                            dispatchCanvas({ type: ActionType.AUTO_ROTATE, autoRotate });
                        }}
                        setPlaying={setPlaying}
                        setCurTime={(curTime: number) => {
                            dispatchCanvas({ type: ActionType.CUR_TIME, curTime });
                        }}
                    />
                </Box>
            </Box>
        </Box>
    );
}
