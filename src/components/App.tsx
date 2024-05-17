import { useState, useEffect } from "react";
import "@/css/app.css";

import { Box, Divider, Drawer } from "@mui/material";

import Scene from "@/components/Scene";
import CellControls from "@/components/CellControls";
import DataControls from "@/components/DataControls";
import PlaybackControls from "@/components/PlaybackControls";

import useSelectionBox from "@/hooks/useSelectionBox";

import { ViewerState, clearUrlHash } from "@/lib/ViewerState";
import { TrackManager, loadTrackManager } from "@/lib/TrackManager";
import { PointCanvas } from "@/lib/PointCanvas";
import LeftSidebarWrapper from "./leftSidebar/LeftSidebarWrapper";

// Ideally we do this here so that we can use initial values as default values for React state.
const initialViewerState = ViewerState.fromUrlHash(window.location.hash);
console.log("initial viewer state: %s", JSON.stringify(initialViewerState));
clearUrlHash();

const drawerWidth = 256;
const playbackFPS = 16;

export default function App() {
    // Use references here for two things:
    // * manage objects that should never change, even when the component re-renders
    // * avoid triggering re-renders when these *do* change

    // data state
    const [dataUrl, setDataUrl] = useState(initialViewerState.dataUrl);
    const [trackManager, setTrackManager] = useState<TrackManager | null>(null);
    const [canvas, setCanvas] = useState<PointCanvas | null>(null);
    const [loading, setLoading] = useState(false);
    const [showTracks, setShowTracks] = useState(true);
    const [showTrackHighlights, setShowTrackHighlights] = useState(true);
    const [numSelectedCells, setNumSelectedCells] = useState(0);

    const { selectedPoints } = useSelectionBox(canvas);
    const [trackHighlightLength, setTrackHighlightLength] = useState(11);
    const [pointBrightness, setPointBrightness] = useState(1);

    // playback state
    const [autoRotate, setAutoRotate] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [curTime, setCurTime] = useState(initialViewerState.curTime);
    const [numTimes, setNumTimes] = useState(0);

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
            setNumTimes(tm?.points.shape[0] || numTimes);
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
        // show a loading indicator if the fetch takes longer than 1 frame (avoid flicker)
        const loadingTimer = setTimeout(() => setLoading(true), 1000 / playbackFPS);
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

                // clearing the timeout prevents the loading indicator from showing at all if the fetch is fast
                clearTimeout(loadingTimer);
                setLoading(false);
                canvas.setPointsPositions(data);
                canvas.resetPointColors(pointBrightness);
            };
            getPoints(canvas, curTime);
        } else {
            clearTimeout(loadingTimer);
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
        if (!canvas) return;
        // update the track highlights
        canvas.showTracks = showTracks;
        canvas.showTrackHighlights = showTrackHighlights;
        const minTime = curTime - trackHighlightLength / 2;
        const maxTime = curTime + trackHighlightLength / 2;
        canvas.updateAllTrackHighlights(minTime, maxTime);
    }, [curTime, trackHighlightLength, showTracks, showTrackHighlights]);

    useEffect(() => {
        const pointsID = canvas?.points.id || -1;
        if (!selectedPoints || !selectedPoints.has(pointsID)) return;
        // keep track of which tracks we are adding to avoid duplicate fetching
        const adding = new Set<number>();

        // this fetches the entire lineage for each track
        const fetchAndAddTrack = async (pointID: number) => {
            if (!canvas || !trackManager) return;
            const minTime = curTime - trackHighlightLength / 2;
            const maxTime = curTime + trackHighlightLength / 2;
            const tracks = await trackManager.fetchTrackIDsForPoint(pointID);
            // TODO: points actually only belong to one track, so can get rid of the outer loop
            for (const t of tracks) {
                const lineage = await trackManager.fetchLineageForTrack(t);
                for (const l of lineage) {
                    if (adding.has(l) || canvas.tracks.has(l)) continue;
                    adding.add(l);
                    const [pos, ids] = await trackManager.fetchPointsForTrack(l);
                    canvas.addTrack(l, pos, ids, minTime, maxTime);
                    setNumSelectedCells((numSelectedCells) => numSelectedCells + 1);
                }
            }
        };

        const selected = selectedPoints.get(pointsID) || [];
        canvas?.highlightPoints(selected);
        setPointBrightness(0.8);

        const maxPointsPerTimepoint = trackManager?.maxPointsPerTimepoint || 0;
        Promise.all(selected.map((p: number) => curTime * maxPointsPerTimepoint + p).map(fetchAndAddTrack));
        // TODO: cancel the fetch if the selection changes?
    }, [selectedPoints]);

    useEffect(() => {
        canvas?.fadePoints(pointBrightness);
    }, [pointBrightness]);

    // TODO: maybe can be done without useEffect?
    // could be a prop into the Scene component
    useEffect(() => {
        if (canvas) {
            canvas.controls.autoRotate = autoRotate;
        }
    }, [autoRotate]);

    // playback time points
    // TODO: this is basic and may drop frames
    useEffect(() => {
        if (playing) {
            const frameDelay = 1000 / playbackFPS; // 1000 / fps
            const interval = setInterval(() => {
                setCurTime((curTime + 1) % numTimes);
            }, frameDelay);
            return () => {
                clearInterval(interval);
            };
        }
    }, [numTimes, curTime, playing]);

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
                                // reset canvas state
                                canvas?.removeAllTracks();
                                // reset component state
                                setNumSelectedCells(0);
                                setPointBrightness(1);
                            }}
                            numSelectedCells={numSelectedCells}
                            trackManager={trackManager}
                            pointBrightness={pointBrightness}
                            setPointBrightness={setPointBrightness}
                        />
                    </Box>
                    <Divider />
                    <Box flexGrow={4} padding="2em">
                        <LeftSidebarWrapper
                            hasTracks={numSelectedCells > 0}
                            trackManager={trackManager}
                            trackHighlightLength={trackHighlightLength}
                            showTracks={showTracks}
                            setShowTracks={setShowTracks}
                            showTrackHighlights={showTrackHighlights}
                            setShowTrackHighlights={setShowTrackHighlights}
                            setTrackHighlightLength={setTrackHighlightLength}
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
                    setCanvas={setCanvas}
                    loading={loading}
                    initialCameraPosition={initialViewerState.cameraPosition}
                    initialCameraTarget={initialViewerState.cameraTarget}
                />
                <Box flexGrow={0} padding="1em">
                    <PlaybackControls
                        enabled={true}
                        autoRotate={autoRotate}
                        playing={playing}
                        curTime={curTime}
                        numTimes={numTimes}
                        setAutoRotate={setAutoRotate}
                        setPlaying={setPlaying}
                        setCurTime={setCurTime}
                    />
                </Box>
            </Box>
        </Box>
    );
}
