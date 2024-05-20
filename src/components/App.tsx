import { useEffect, useRef, useState } from "react";
import "@/css/app.css";

import { Box, Divider, Drawer } from "@mui/material";

import Scene from "@/components/Scene";
import CellControls from "@/components/CellControls";
import DataControls from "@/components/DataControls";
import PlaybackControls from "@/components/PlaybackControls";

import useSelectionBox from "@/hooks/useSelectionBox";
import { usePointCanvas, ActionType } from "@/hooks/usePointCanvas";

import { ViewerState, clearUrlHash } from "@/lib/ViewerState";
import { TrackManager, loadTrackManager } from "@/lib/TrackManager";
import { PointCanvas } from "@/lib/PointCanvas";
import LeftSidebarWrapper from "./leftSidebar/LeftSidebarWrapper";

// Ideally we do this here so that we can use initial values as default values for React state.
const initialViewerState = ViewerState.fromUrlHash(window.location.hash);
console.log("initial viewer state: %s", JSON.stringify(initialViewerState));
clearUrlHash();

const drawerWidth = 256;

export default function App() {
    // Use references here for two things:
    // * manage objects that should never change, even when the component re-renders
    // * avoid triggering re-renders when these *do* change

    // TrackManager handles data fetching
    const [trackManager, setTrackManager] = useState<TrackManager | null>(null);
    const numTimes = trackManager?.points.shape[0] || 0;
    // TODO: dataUrl can be stored in the TrackManager only
    const [dataUrl, setDataUrl] = useState(initialViewerState.dataUrl);
    const [loading, setLoading] = useState(false);

    // PointCanvas is a Three.js canvas, updated via reducer
    const sceneDivRef = useRef<HTMLDivElement>(null);
    const [canvas, dispatchCanvas] = usePointCanvas(sceneDivRef, initialViewerState);
    const numTracksLoaded = canvas?.tracks.size || 0;
    const trackHighlightLength = canvas ? canvas.maxTime - canvas.minTime : 11;

    const { selectedPoints } = useSelectionBox(canvas);

    // playback state is all handled in React
    const [playing, setPlaying] = useState(false);
    const [curTime, setCurTime] = useState(initialViewerState.curTime);

    // Manage shareable state than can persist across sessions.
    const copyShareableUrlToClipboard = () => {
        if (canvas === null) return;
        console.log("copy shareable URL to clipboard");
        const state = new ViewerState(dataUrl, curTime, canvas.camera.position, canvas.controls.target);
        const url = window.location.toString() + "#" + state.toUrlHash();
        navigator.clipboard.writeText(url);
    };

    const setStateFromHash = () => {
        const state = ViewerState.fromUrlHash(window.location.hash);
        clearUrlHash();
        setDataUrl(state.dataUrl);
        setCurTime(state.curTime);
        canvas?.setCameraProperties(state.cameraPosition, state.cameraTarget);
    };
    // update the state when the hash changes, but only register the listener once
    useEffect(() => {
        window.addEventListener("hashchange", setStateFromHash);
        return () => {
            window.removeEventListener("hashchange", setStateFromHash);
        };
    }, []);

    // update the array when the dataUrl changes
    useEffect(() => {
        console.log("load data from %s", dataUrl);
        const trackManager = loadTrackManager(dataUrl);
        // TODO: add clean-up by returning another closure
        trackManager.then((tm: TrackManager | null) => {
            setTrackManager(tm);
            // Defend against the case when a curTime valid for previous data
            // is no longer valid.
            setCurTime(Math.min(curTime, tm?.points.shape[0] - 1 || numTimes - 1));
        });
    }, [dataUrl]);

    // update the geometry buffers when the array changes
    // TODO: do this in the above useEffect
    useEffect(() => {
        if (!trackManager || !canvas) return;
        canvas.initPointsGeometry(trackManager.maxPointsPerTimepoint);
    }, [trackManager]);

    // update the points when the array or timepoint changes
    useEffect(() => {
        // show a loading indicator if the fetch takes longer than 10ms (avoid flicker)
        const loadingTimer = setTimeout(() => setLoading(true), 100);
        let ignore = false;
        // TODO: this is a very basic attempt to prevent stale data
        // in addition, we should debounce the input and verify the data is current
        // before rendering it
        if (canvas && trackManager && !ignore) {
            const getPoints = async (canvas: PointCanvas, time: number) => {
                console.debug("fetch points at time %d", time);
                const data = await trackManager.fetchPointsAtTime(time);
                console.debug("got %d points for time %d", data.length / 3, time);

                if (ignore) {
                    console.debug("IGNORE SET points at time %d", time);
                    return;
                }

                // clearTimeout(loadingTimer);
                setTimeout(() => setLoading(false), 250);
                setLoading(false);
                canvas.setPointsPositions(data);
                canvas.resetPointColors();
            };
            getPoints(canvas, curTime);
        } else {
            // clearTimeout(loadingTimer);
            setTimeout(() => setLoading(false), 250);
            setLoading(false);
            console.debug("IGNORE FETCH points at time %d", curTime);
        }

        // stop playback if there is no data
        if (!trackManager) {
            setPlaying(false);
        }

        return () => {
            clearTimeout(loadingTimer);
            ignore = true;
        };
    }, [trackManager, curTime]);

    useEffect(() => {
        const pointsID = canvas?.points.id || -1;
        if (!selectedPoints || !selectedPoints.has(pointsID)) return;
        // keep track of which tracks we are adding to avoid duplicate fetching
        const adding = new Set<number>();

        // this fetches the entire lineage for each track
        const fetchAndAddTrack = async (pointID: number) => {
            if (!canvas || !trackManager) return;
            const tracks = await trackManager.fetchTrackIDsForPoint(pointID);
            // TODO: points actually only belong to one track, so can get rid of the outer loop
            for (const t of tracks) {
                const lineage = await trackManager.fetchLineageForTrack(t);
                for (const l of lineage) {
                    if (adding.has(l) || canvas.tracks.has(l)) continue;
                    adding.add(l);
                    const [pos, ids] = await trackManager.fetchPointsForTrack(l);
                    // adding the track *in* the dispatcher creates issues with duplicate fetching
                    canvas.addTrack(l, pos, ids);
                    dispatchCanvas({ type: ActionType.REFRESH });
                }
            }
        };

        dispatchCanvas({ type: ActionType.POINT_BRIGHTNESS, brightness: 0.8 });

        const selected = selectedPoints.get(pointsID) || [];
        dispatchCanvas({ type: ActionType.HIGHLIGHT_POINTS, points: selected });

        const maxPointsPerTimepoint = trackManager?.maxPointsPerTimepoint || 0;
        Promise.all(selected.map((p: number) => curTime * maxPointsPerTimepoint + p).map(fetchAndAddTrack));
        // TODO: cancel the fetch if the selection changes?
    }, [selectedPoints]);

    // playback time points
    // TODO: this is basic and may drop frames
    useEffect(() => {
        if (playing) {
            const frameDelay = 1000 / 8; // 1000 / fps
            const interval = setInterval(() => {
                setCurTime((curTime + 1) % numTimes);
            }, frameDelay);
            return () => {
                clearInterval(interval);
            };
        }
    }, [curTime, playing]);

    useEffect(() => {
        if (!canvas) return;
        dispatchCanvas({
            type: ActionType.SET_MIN_MAX_TIME,
            minTime: curTime - trackHighlightLength / 2,
            maxTime: curTime + trackHighlightLength / 2,
        });
    }, [curTime]);

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
                            numSelectedCells={canvas?.tracks.size ?? 0}
                            trackManager={trackManager}
                            pointBrightness={canvas?.pointBrightness ?? 1}
                            setPointBrightness={(brightness: number) => {
                                dispatchCanvas({ type: ActionType.POINT_BRIGHTNESS, brightness });
                            }}
                        />
                    </Box>
                    <Divider />
                    <Box flexGrow={4} padding="2em">
                        <LeftSidebarWrapper
                            hasTracks={numTracksLoaded > 0}
                            trackManager={trackManager}
                            trackHighlightLength={trackHighlightLength}
                            showTracks={canvas ? canvas.showTracks : true}
                            setShowTracks={(show: boolean) => {
                                dispatchCanvas({ type: ActionType.SHOW_TRACKS, showTracks: show });
                            }}
                            showTrackHighlights={canvas ? canvas.showTrackHighlights : true}
                            setShowTrackHighlights={(show: boolean) => {
                                dispatchCanvas({ type: ActionType.SHOW_TRACK_HIGHLIGHTS, showTrackHighlights: show });
                            }}
                            setTrackHighlightLength={(length: number) => {
                                dispatchCanvas({
                                    type: ActionType.SET_MIN_MAX_TIME,
                                    minTime: curTime - length / 2,
                                    maxTime: curTime + length / 2,
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
                    loading={loading}
                    initialCameraPosition={initialViewerState.cameraPosition}
                    initialCameraTarget={initialViewerState.cameraTarget}
                />
                <Box flexGrow={0} padding="1em">
                    <PlaybackControls
                        enabled={true}
                        autoRotate={canvas ? canvas.controls.autoRotate : false}
                        playing={playing}
                        curTime={curTime}
                        numTimes={numTimes}
                        setAutoRotate={(autoRotate: boolean) => {
                            dispatchCanvas({ type: ActionType.AUTO_ROTATE, autoRotate });
                        }}
                        setPlaying={setPlaying}
                        setCurTime={setCurTime}
                    />
                </Box>
            </Box>
        </Box>
    );
}
