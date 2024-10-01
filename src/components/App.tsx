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
import { TrackDownloadData } from "./DownloadButton";

import config from "../../CONFIG.ts";
const brandingName = config.branding.name || undefined;
const brandingLogoPath = config.branding.logo_path || undefined;

// Ideally we do this here so that we can use initial values as default values for React state.
const initialViewerState = ViewerState.fromUrlHash(window.location.hash);
console.log("initial viewer state: ", initialViewerState);
clearUrlHash();

function detectDeviceType(): { isPhone: boolean; isTablet: boolean; isMobile: boolean } {
    const ua = navigator.userAgent || navigator.vendor;

    // Detect iPads, iPhones, and iPods based on the user agent string
    const isiPad =
        /iPad/.test(ua) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
    const isiPhoneOrIPod = /iPhone|iPod/.test(ua);

    // Detect Android phones and tablets
    const isAndroidPhone = /Android/.test(ua) && /Mobile/.test(ua);
    const isAndroidTablet = /Android/.test(ua) && !/Mobile/.test(ua);

    // Screen size check (tablets typically have a wider screen)
    const isSmallScreen = window.screen.width <= 768;

    // Determine if it's a phone, tablet, or desktop
    const isPhone = isiPhoneOrIPod || isAndroidPhone || isSmallScreen;
    const isTablet = isiPad || isAndroidTablet || (!isPhone && isSmallScreen && window.screen.width > 600); // Optional: Add a threshold for larger screens
    const isDesktop = !isPhone && !isTablet; // It's a desktop if it's neither a phone nor a tablet

    return {
        isPhone: isPhone,
        isTablet: isTablet && !isPhone, // To avoid small phones being miscategorized as tablets
        isMobile: !isDesktop,
    };
}

export const detectedDevice = detectDeviceType();
console.log("detectDeviceType: ", detectDeviceType());
window.alert(
    "detected device type (desktop | tablet | phone) = (" +
        !detectDeviceType().isMobile +
        " | " +
        detectDeviceType().isTablet +
        " | " +
        detectDeviceType().isPhone +
        ")",
);

const drawerWidth = 256;
const playbackFPS = 16;
const playbackIntervalMs = 1000 / playbackFPS;

export default function App() {
    // TrackManager handles data fetching
    const [trackManager, setTrackManager] = useState<TrackManager | null>(null);
    const numTimes = trackManager?.numTimes ?? 0;
    // TODO: dataUrl can be stored in the TrackManager only
    const [dataUrl, setDataUrl] = useState(initialViewerState.dataUrl);

    // PointCanvas is a Three.js canvas, updated via reducer
    const [canvas, dispatchCanvas, sceneDivRef] = usePointCanvas(initialViewerState);
    const numSelectedCells = canvas.selectedPointIds.size;
    const numSelectedTracks = canvas.tracks.size;
    const trackHighlightLength = canvas.maxTime - canvas.minTime;

    // this state is pure React
    const [playing, setPlaying] = useState(false);
    const [isLoadingPoints, setIsLoadingPoints] = useState(false);
    const [numLoadingTracks, setNumLoadingTracks] = useState(0);

    // Manage shareable state that can persist across sessions.
    const copyShareableUrlToClipboard = () => {
        console.log("copy shareable URL to clipboard");
        const state = canvas.toState();
        if (trackManager) {
            state.dataUrl = trackManager.store;
        }
        const url = window.location.toString() + state.toUrlHash();
        navigator.clipboard.writeText(url);
    };
    const setStateFromHash = useCallback(() => {
        const state = ViewerState.fromUrlHash(window.location.hash);
        clearUrlHash();
        setDataUrl(state.dataUrl);
        dispatchCanvas({ type: ActionType.UPDATE_WITH_STATE, state: state });
    }, [dispatchCanvas]);
    const removeTracksUponNewData = () => {
        dispatchCanvas({ type: ActionType.REMOVE_ALL_TRACKS });
    };

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
                    return Math.min(c, tm?.numTimes ? tm.numTimes - 1 : 0);
                },
            });
        });
    }, [dispatchCanvas, dataUrl]);

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
        // show a loading indicator if the fetch takes longer than 1/2 a frame (avoid flicker)
        const loadingTimeout = setTimeout(() => setIsLoadingPoints(true), playbackIntervalMs / 2);
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

    // This fetches track IDs based on the selected point IDs.
    useEffect(() => {
        console.debug("effect-selectedPointIds: ", trackManager, canvas.selectedPointIds);
        if (!trackManager) return;
        if (canvas.selectedPointIds.size == 0) return;

        // this fetches the entire lineage for each track
        const updateTracks = async () => {
            console.debug("updateTracks: ", canvas.selectedPointIds);
            canvas.selectedPointIds.forEach(async (pointId) => {
                if (canvas.fetchedPointIds.has(pointId)) return;
                setNumLoadingTracks((n) => n + 1);
                canvas.fetchedPointIds.add(pointId);
                const trackIds = await trackManager.fetchTrackIDsForPoint(pointId);
                // TODO: points actually only belong to one track, so can get rid of the outer loop
                trackIds.forEach(async (trackId) => {
                    if (canvas.fetchedRootTrackIds.has(trackId)) return;
                    canvas.fetchedRootTrackIds.add(trackId);
                    const [lineage, trackData] = await trackManager.fetchLineageForTrack(trackId);
                    lineage.forEach(async (relatedTrackId: number, index) => {
                        if (canvas.tracks.has(relatedTrackId)) return;
                        const [pos, ids] = await trackManager.fetchPointsForTrack(relatedTrackId);
                        // adding the track *in* the dispatcher creates issues with duplicate fetching
                        // but we refresh so the selected/loaded count is updated
                        canvas.addTrack(relatedTrackId, pos, ids, trackData[index]);
                        canvas.clearPointIndicesCache;
                        dispatchCanvas({ type: ActionType.REFRESH });
                    });
                });
                setNumLoadingTracks((n) => n - 1);
            });
        };
        updateTracks();
        // TODO: add missing dependencies
    }, [trackManager, dispatchCanvas, canvas.selectedPointIds]);

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

    const getTrackDownloadData = () => {
        const trackData: TrackDownloadData[] = [];
        canvas.tracks.forEach((track, trackID) => {
            // Keep track of the timepoints we've seen in this track to avoid duplication
            // This is necessary because if a track contains a single point, we set
            // the start and end positions to be the same
            const timepointsInTrack = new Set();

            const startPositions = track.threeTrack.geometry.getAttribute("instanceStart");
            const startTimes = track.threeTrack.geometry.getAttribute("instanceTimeStart");

            for (let i = 0; i < startTimes.count; i++) {
                timepointsInTrack.add(startTimes.getX(i));
                trackData.push([
                    // trackID is 1-indexed in input and output CSVs
                    trackID + 1,
                    startTimes.getX(i),
                    startPositions.getX(i),
                    startPositions.getY(i),
                    startPositions.getZ(i),
                    track.parentTrackID,
                ]);
            }
            const endPositions = track.threeTrack.geometry.getAttribute("instanceEnd");
            const endTimes = track.threeTrack.geometry.getAttribute("instanceTimeEnd");
            const lastIndex = endPositions.count - 1;

            // Only add the end position if it's not the same as the start position
            if (!timepointsInTrack.has(endTimes.getX(lastIndex))) {
                trackData.push([
                    // trackID is 1-indexed in input and output CSVs
                    trackID + 1,
                    endTimes.getX(lastIndex),
                    endPositions.getX(lastIndex),
                    endPositions.getY(lastIndex),
                    endPositions.getZ(lastIndex),
                    track.parentTrackID,
                ]);
            }
        });

        // Round to 3 decimal places
        const formatter = Intl.NumberFormat("en-US", { useGrouping: false });
        return trackData.map((row) => row.map(formatter.format));
    };

    return (
        <Box sx={{ display: "flex", width: "100%", height: "100%" }}>
            {/* TODO: components *could* go deeper still for organization */}
            {!detectedDevice.isPhone && (
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
                            {brandingLogoPath && <img src={brandingLogoPath} alt="" />}
                            {brandingLogoPath && brandingName && <Divider orientation="vertical" flexItem />}
                            {brandingName && <h2>{brandingName}</h2>}{" "}
                        </Box>
                        <Box flexGrow={0} padding="2em">
                            <CellControls
                                clearTracks={() => {
                                    dispatchCanvas({ type: ActionType.REMOVE_ALL_TRACKS });
                                }}
                                getTrackDownloadData={getTrackDownloadData}
                                numSelectedCells={numSelectedCells}
                                numSelectedTracks={numSelectedTracks}
                                trackManager={trackManager}
                                pointBrightness={canvas.pointBrightness}
                                setPointBrightness={(brightness: number) => {
                                    dispatchCanvas({ type: ActionType.POINT_BRIGHTNESS, brightness });
                                }}
                                selectionMode={canvas.selector.selectionMode}
                                setSelectionMode={(value: PointSelectionMode) => {
                                    dispatchCanvas({ type: ActionType.SELECTION_MODE, selectionMode: value });
                                }}
                                isMobile={detectedDevice.isMobile}
                                MobileSelectCells={() => {
                                    dispatchCanvas({ type: ActionType.MOBILE_SELECT_CELLS });
                                }}
                            />
                        </Box>
                        <Divider />
                        <Box flexGrow={4} padding="2em">
                            <LeftSidebarWrapper
                                hasTracks={numSelectedCells > 0}
                                trackManager={trackManager}
                                trackHighlightLength={trackHighlightLength}
                                selectionMode={canvas.selector.selectionMode}
                                showTracks={canvas.showTracks}
                                setShowTracks={(show: boolean) => {
                                    dispatchCanvas({ type: ActionType.SHOW_TRACKS, showTracks: show });
                                }}
                                showTrackHighlights={canvas.showTrackHighlights}
                                setShowTrackHighlights={(show: boolean) => {
                                    dispatchCanvas({
                                        type: ActionType.SHOW_TRACK_HIGHLIGHTS,
                                        showTrackHighlights: show,
                                    });
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
                                removeTracksUponNewData={removeTracksUponNewData}
                                copyShareableUrlToClipboard={copyShareableUrlToClipboard}
                                trackManager={trackManager}
                            />
                        </Box>
                    </Box>
                </Drawer>
            )}

            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                }}
            >
                <Scene ref={sceneDivRef} isLoading={isLoadingPoints || numLoadingTracks > 0} />
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
