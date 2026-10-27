import { useCallback, useEffect, useRef, useState } from "react";
import "@/css/app.css";

import { Box, Divider, Drawer } from "@mui/material";

import Scene from "@/components/Scene";
import CellControls from "@/components/CellControls";
import DataControls from "@/components/DataControls";
import PlaybackControls from "@/components/PlaybackControls";
import WarningDialog from "@/components/WarningDialog";

import { usePointCanvas, ActionType } from "@/hooks/usePointCanvas";

import { ViewerState, clearUrlHash } from "@/lib/ViewerState";
import { Option, TrackManager, loadTrackManager, numberOfDefaultColorByOptions } from "@/lib/TrackManager";
import { PointSelectionMode } from "@/lib/PointSelector";
import LeftSidebarWrapper from "./leftSidebar/LeftSidebarWrapper";
// import { TimestampOverlay } from "./overlays/TimestampOverlay";
import { ColorMapTracks, ColorMapCells } from "./overlays/ColorMap.tsx";
import { TissueHoverOverlay } from "./overlays/TissueHoverOverlay";
import { TrackDownloadData } from "./DownloadButton";
import SaveVideoButton, { RecordingConfig, RecordingState } from "./SaveVideoButton";

import config from "../../CONFIG.ts";
import deviceState from "@/lib/DeviceState.ts";
const brandingName = config.branding.name || undefined;
const brandingLogoPath = config.branding.logo_path || undefined;
const maxNumSelectedCells = config.settings.max_num_selected_cells || 100;

// Ideally we do this here so that we can use initial values as default values for React state.
const initialViewerState = ViewerState.fromUrlHash(window.location.hash);
console.log("initial viewer state: ", initialViewerState);
clearUrlHash();

const drawerWidth = 256;
const playbackFPS = 16;
const playbackIntervalMs = 1000 / playbackFPS;

// Define the hook for changes of deviceState
const useDetectedDevice = () => {
    const [detectedDevice, setDetectedDevice] = useState(deviceState.current);

    useEffect(() => {
        const unsubscribe = deviceState.subscribe(setDetectedDevice);
        return () => {
            unsubscribe();
        };
    }, []);

    return detectedDevice;
};

export default function App() {
    const detectedDevice = useDetectedDevice();

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
    const [isLoadingPoints, setIsLoadingPoints] = useState(true);
    const [numLoadingTracks, setNumLoadingTracks] = useState(0);

    // recording state
    const [recordingState, setRecordingState] = useState<RecordingState | null>(null);
    // ref so effect-curTime can check recording status without adding recordingState to its deps
    const isRecordingActiveRef = useRef(false);
    isRecordingActiveRef.current = !!recordingState?.active;

    // refresh window to initial state
    const refreshPage = () => {
        // maxPointsPerTimepoint is only updated once the TrackManager is loaded, but we
        // need to update the value in initialViewerState because that is used by the reset button
        // which may not change the dataUrl and thus may not load a new TrackManager.
        initialViewerState.maxPointsPerTimepoint = canvas.maxPointsPerTimepoint;
        setDataUrl(initialViewerState.dataUrl);
        dispatchCanvas({ type: ActionType.UPDATE_WITH_STATE, state: initialViewerState });
    };
    // show a warning dialog before fetching lots of tracks
    const [showWarningDialog, setShowWarningDialog] = useState(false);
    const [numUnfetchedPoints, setNumUnfetchedPoints] = useState(0);
    const [pendingTrackLoader, setPendingTrackLoader] = useState<(() => void) | null>(null);
    const [pendingCancelAction, setPendingCancelAction] = useState<(() => void) | null>(null);
    const [warningMessage, setWarningMessage] = useState<string | undefined>(undefined);
    const [hoveredTissue, setHoveredTissue] = useState<{ name: string; hexColor: number } | null>(null);

    // Keep a ref to the latest canvas so the mousemove handler is never stale
    const canvasRef = useRef(canvas);
    canvasRef.current = canvas;
    const trackManagerRef = useRef(trackManager);
    trackManagerRef.current = trackManager;

    // Mousemove raycaster — works in all selector modes, no yellow sphere side effect
    useEffect(() => {
        const div = sceneDivRef.current;
        if (!div) return;

        const onMouseMove = (e: MouseEvent) => {
            const c = canvasRef.current;
            const tm = trackManagerRef.current;
            if (!tm) return;
            if (c.colorByEvent.type !== "hex" && c.colorByEvent.type !== "hex-binary") {
                setHoveredTissue(null);
                return;
            }
            const rect = div.getBoundingClientRect();
            const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            const cellIndex = c.getHoveredCellIndex(ndcX, ndcY);
            console.debug(
                "[hover] cellIndex:",
                cellIndex,
                "colorByEvent:",
                c.colorByEvent.type,
                c.colorByEvent.name,
                "currentAttributes.length:",
                c.currentAttributes.length,
            );
            if (cellIndex === null) {
                setHoveredTissue(null);
                return;
            }
            const hexInt = c.currentAttributes[cellIndex];
            console.debug("[hover] hexInt:", hexInt, `(#${hexInt?.toString(16)})`);
            if (hexInt === undefined || hexInt === 4210752) {
                setHoveredTissue(null);
                return;
            }
            let name: string | null = null;
            if (c.colorByEvent.type === "hex-binary") {
                name = c.colorByEvent.name.replace(/_annot$/, "");
                console.debug("[hover] hex-binary → tissue:", name);
            } else if (c.colorByEvent.type === "hex") {
                name = tm.hexColorToTissueName.get(hexInt) ?? null;
                console.debug("[hover] hex → reverse lookup:", name, "(map size:", tm.hexColorToTissueName.size, ")");
            }
            setHoveredTissue(name !== null ? { name, hexColor: hexInt } : null);
        };

        div.addEventListener("mousemove", onMouseMove);
        return () => div.removeEventListener("mousemove", onMouseMove);
    }, [sceneDivRef]); // stable ref object — .current accessed inside the effect

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
    const actionsUponNewData = () => {
        dispatchCanvas({ type: ActionType.RESET_CAMERA });
        dispatchCanvas({ type: ActionType.RESET_POINT_SIZE });
        dispatchCanvas({ type: ActionType.TOGGLE_COLOR_BY, colorBy: false });
    };

    // Fetches fatemap attributes for the current timepoint (if lineage mode is active),
    // stores them directly on the canvas, then resets point colors.
    // Called after any track loading completes so coloring applies immediately.
    const finalizeTrackLoading = async () => {
        let fatemapAttributes: Float32Array | undefined;
        if (
            trackManager !== null &&
            canvas.colorByEvent.type === "hex-binary" &&
            trackManager.fatemapHexAttributeIndex !== null
        ) {
            fatemapAttributes = await trackManager.fetchAttributesAtTime(
                canvas.curTime,
                trackManager.fatemapHexAttributeIndex,
            );
        }
        dispatchCanvas({ type: ActionType.RESET_POINTS_COLORS, fatemapAttributes });
    };

    // this function fetches the entire lineage for each track, using Promise.allSettled
    // to keep the loading indicator visible until all tracks have been rendered
    const updateTracks = async () => {
        if (!trackManager) return;
        console.debug("updateTracks: ", canvas.selectedPointIds);

        const allTrackPromises: Promise<void>[] = [];

        canvas.selectedPointIds.forEach((pointId) => {
            if (canvas.fetchedPointIds.has(pointId)) return;

            setNumLoadingTracks((n) => n + 1);
            canvas.fetchedPointIds.add(pointId);

            const trackPromise = trackManager.fetchTrackIDsForPoint(pointId).then(async (trackIds) => {
                // TODO: points actually only belong to one track, so can get rid of the outer loop
                const lineagePromises: Promise<void>[] = [];

                for (const trackId of trackIds) {
                    if (canvas.fetchedRootTrackIds.has(trackId)) continue;

                    canvas.fetchedRootTrackIds.add(trackId);

                    const lineagePromise = trackManager
                        .fetchLineageForTrack(trackId)
                        .then(async ([lineage, trackData]) => {
                            const relatedTrackPromises: Promise<void>[] = [];

                            for (const [index, relatedTrackId] of lineage.entries()) {
                                if (canvas.tracks.has(relatedTrackId)) continue;

                                const pointsPromise = trackManager
                                    .fetchPointsForTrack(relatedTrackId)
                                    .then(([pos, ids]) => {
                                        // adding the track *in* the dispatcher creates issues with duplicate fetching
                                        // but we refresh so the selected/loaded count is updated
                                        canvas.addTrack(relatedTrackId, pos, ids, trackData[index]);
                                        dispatchCanvas({ type: ActionType.REFRESH });
                                    });

                                relatedTrackPromises.push(pointsPromise);
                            }

                            await Promise.allSettled(relatedTrackPromises);
                        });

                    lineagePromises.push(lineagePromise);
                }

                await Promise.allSettled(lineagePromises);
            });

            allTrackPromises.push(trackPromise);

            trackPromise.finally(() => {
                setNumLoadingTracks((n) => n - 1);
            });
        });

        await Promise.allSettled(allTrackPromises);
        console.log("All tracks have been rendered on the canvas");
        await finalizeTrackLoading();
    };

    // loads only the annotated tracks directly, without expanding to the full lineage
    const loadTissueTracks = async () => {
        if (!trackManager) return;
        const attributeIndex = canvas.colorByEvent.label - numberOfDefaultColorByOptions;
        const pointIds = trackManager.annotPointIds?.[attributeIndex];
        if (!pointIds) return;

        // Mark as fetched before dispatching so the selectedPointIds useEffect
        // sees numUnfetchedPoints = 0 and does not trigger updateTracks.
        for (const pointId of pointIds) {
            canvas.fetchedPointIds.add(pointId);
        }
        dispatchCanvas({
            type: ActionType.ADD_SELECTED_POINT_IDS,
            selectedPointIndices: [],
            selectedPointIds: new Set(pointIds),
        });

        const allTrackPromises: Promise<void>[] = [];

        for (const pointId of pointIds) {
            setNumLoadingTracks((n) => n + 1);
            const trackPromise = trackManager.fetchTrackIDsForPoint(pointId).then(async (trackIds) => {
                const perTrackPromises = Array.from(trackIds)
                    .filter((trackId) => !canvas.tracks.has(trackId))
                    .map((trackId) =>
                        trackManager.fetchPointsForTrack(trackId).then(([pos, ids]) => {
                            canvas.addTrack(trackId, pos, ids, -1);
                            dispatchCanvas({ type: ActionType.REFRESH });
                        }),
                    );
                await Promise.allSettled(perTrackPromises);
            });
            allTrackPromises.push(trackPromise);
            trackPromise.finally(() => setNumLoadingTracks((n) => n - 1));
        }

        await Promise.allSettled(allTrackPromises);
        console.log("All tissue tracks have been rendered on the canvas");
        await finalizeTrackLoading();
    };

    const handleTissueTracks = () => {
        if (!trackManager) return;
        const attributeIndex = canvas.colorByEvent.label - numberOfDefaultColorByOptions;
        const pointIds = trackManager.annotPointIds?.[attributeIndex];
        if (!pointIds) return;

        if (pointIds.length > maxNumSelectedCells) {
            setNumUnfetchedPoints(pointIds.length);
            setPendingTrackLoader(() => loadTissueTracks);
            setPendingCancelAction(null); // tissue path adds no selectedPointIds, nothing to undo
            setWarningMessage(
                `This will load ${pointIds.length} tissue tracks, which might take a long time. Continue?`,
            );
            setShowWarningDialog(true);
        } else {
            loadTissueTracks();
        }
    };

    // remove the just selected points from selectedPointIds if user 'cancels' the fetching of tracks
    const removeLastSelectedPoints = async () => {
        dispatchCanvas({ type: ActionType.REMOVE_LAST_SELECTION });
        dispatchCanvas({ type: ActionType.RESET_POINTS_COLORS });
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
        console.debug("effect-dataUrl");
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

    useEffect(() => {
        console.debug("effect-trackmanager");
        if (!trackManager) return;
        dispatchCanvas({
            type: ActionType.INIT_POINTS_GEOMETRY,
            maxPointsPerTimepoint: trackManager.maxPointsPerTimepoint,
        });
        dispatchCanvas({
            type: ActionType.CHECK_CAMERA_LOCK,
            ndim: trackManager.ndim,
        });
    }, [dispatchCanvas, trackManager]);

    // update the points when the array or timepoint changes
    useEffect(() => {
        console.debug("effect-curTime");
        // During recording we must mark loading immediately so the capture loop never reads
        // isLoadingPoints===false while a fetch is still in-flight (the debounce would leave a
        // ~31 ms window where the stale frame could be captured). During normal playback we keep
        // the debounce to avoid a loading-indicator flicker on fast fetches.
        let loadingTimeout: ReturnType<typeof setTimeout> | undefined;
        if (isRecordingActiveRef.current) {
            setIsLoadingPoints(true);
        } else {
            loadingTimeout = setTimeout(() => setIsLoadingPoints(true), playbackIntervalMs / 2);
        }
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

                let attributes;
                if (canvas.colorByEvent.action === "provided" || canvas.colorByEvent.action === "provided-normalized") {
                    attributes = await trackManager.fetchAttributesAtTime(
                        time,
                        canvas.colorByEvent.label - numberOfDefaultColorByOptions,
                    );
                }

                let fatemapAttributes: Float32Array | undefined;
                if (
                    canvas.colorByEvent.type === "hex-binary" &&
                    trackManager.fatemapHexAttributeIndex !== null &&
                    canvas.tracks.size > 0
                ) {
                    fatemapAttributes = await trackManager.fetchAttributesAtTime(
                        time,
                        trackManager.fatemapHexAttributeIndex,
                    );
                }

                let secondaryAttributes: Float32Array | undefined;
                if (canvas.colorBySecondEvent && canvas.colorByEvent.type === "hex-binary") {
                    secondaryAttributes = await trackManager.fetchAttributesAtTime(
                        time,
                        canvas.colorBySecondEvent.label - numberOfDefaultColorByOptions,
                    );
                }

                if (ignore) {
                    console.debug("IGNORE SET points at time %d (after fatemap fetch)", time);
                    return;
                }

                // clearing the timeout prevents the loading indicator from showing at all if the fetch is fast
                clearTimeout(loadingTimeout);
                setIsLoadingPoints(false);
                dispatchCanvas({
                    type: ActionType.POINTS_POSITIONS,
                    positions: data,
                    attributes,
                    fatemapAttributes,
                    secondaryAttributes,
                });
            };
            getPoints(canvas.curTime);
        } else {
            clearTimeout(loadingTimeout);
            // setIsLoadingPoints(false); // removed this line to make the loading indicated turn on from the beginning, until all points loaded
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
    }, [canvas.curTime, canvas.colorByEvent, canvas.colorBySecondEvent, dispatchCanvas, trackManager]);

    // This fetches track IDs based on the selected point IDs.
    useEffect(() => {
        console.debug("effect-selectedPointIds: ", trackManager, canvas.selectedPointIds);
        if (!trackManager) return;
        if (canvas.selectedPointIds.size == 0) return;

        // check how many new points are selected
        let numUnfetchedPoints = 0;
        canvas.selectedPointIds.forEach((pointId) => {
            if (!canvas.fetchedPointIds.has(pointId)) {
                numUnfetchedPoints = numUnfetchedPoints + 1;
            }
        });

        // if many cells are selected, let the user decide whether to fetch or cancel
        if (numUnfetchedPoints > maxNumSelectedCells) {
            setNumUnfetchedPoints(numUnfetchedPoints);
            setPendingTrackLoader(() => updateTracks);
            setPendingCancelAction(() => removeLastSelectedPoints);
            setWarningMessage(
                `This will load the full lineage of ${numUnfetchedPoints} selected cells, which may include many more tracks and could take a long time. Continue?`,
            );
            setShowWarningDialog(true);
        } else {
            updateTracks();
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps -- updateTracks and fetchedPointIds intentionally omitted; updateTracks is not memoized and would cause infinite re-renders
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

    // Expose loading state and controls globally for the CLI Playwright recorder
    useEffect(() => {
        // eslint-disable-next-line camelcase
        (window as unknown as Record<string, unknown>).__intracktive_loading = isLoadingPoints || numLoadingTracks > 0;
        // eslint-disable-next-line camelcase
        (window as unknown as Record<string, unknown>).__intracktive_numTimes = numTimes;
    }, [isLoadingPoints, numLoadingTracks, numTimes]);

    // Frame-by-frame recording capture loop
    useEffect(() => {
        if (!recordingState?.active) return;

        // After dispatching a new curTime there is a short debounce window (~playbackIntervalMs/2)
        // before isLoadingPoints becomes true. We skip one effect cycle using justAdvanced so we
        // don't accidentally capture the previous frame's pixels.
        if (recordingState.justAdvanced) {
            setRecordingState((prev) => prev && { ...prev, justAdvanced: false });
            return;
        }

        if (isLoadingPoints || numLoadingTracks > 0) return;
        if (canvas.curTime !== recordingState.targetTime) return;

        // Wait for Three.js to render the new frame before reading the canvas pixels
        requestAnimationFrame(() => {
            const dataURL = canvas.renderer.domElement.toDataURL("image/png");
            const newFrames = [...recordingState.capturedFrames, dataURL];
            const nextTime = recordingState.targetTime + recordingState.config.frameSkip;

            if (nextTime >= numTimes) {
                if (recordingState.originalSize) {
                    dispatchCanvas({
                        type: ActionType.SIZE,
                        width: recordingState.originalSize.width,
                        height: recordingState.originalSize.height,
                    });
                    dispatchCanvas({ type: ActionType.POINT_SIZES, pointSize: recordingState.originalSize.pointSize });
                }
                setRecordingState({ ...recordingState, active: false, capturedFrames: newFrames });
            } else {
                dispatchCanvas({ type: ActionType.CUR_TIME, curTime: nextTime });
                setRecordingState({
                    ...recordingState,
                    targetTime: nextTime,
                    capturedFrames: newFrames,
                    justAdvanced: true,
                });
            }
        });
    }, [
        recordingState,
        isLoadingPoints,
        numLoadingTracks,
        canvas.curTime,
        canvas.renderer.domElement,
        numTimes,
        dispatchCanvas,
    ]);

    const startRecording = useCallback(
        (config: RecordingConfig) => {
            setPlaying(false);
            dispatchCanvas({ type: ActionType.CUR_TIME, curTime: 0 });

            const el = canvas.renderer.domElement;
            const origW = el.clientWidth;
            const origH = el.clientHeight;
            const origPointSize = canvas.pointSize;
            const scale = Math.max(2, window.devicePixelRatio || 1);

            // updateStyle: false enlarges the pixel buffer without changing CSS layout
            dispatchCanvas({ type: ActionType.SIZE, width: origW * scale, height: origH * scale, updateStyle: false });
            // Scale point size so dots appear the same size in the output video
            dispatchCanvas({ type: ActionType.POINT_SIZES, pointSize: origPointSize * scale });

            setRecordingState({
                active: true,
                config,
                targetTime: 0,
                capturedFrames: [],
                justAdvanced: true,
                originalSize: { width: origW, height: origH, pointSize: origPointSize },
            });
        },
        [canvas.pointSize, canvas.renderer.domElement, dispatchCanvas, setPlaying],
    );

    const cancelRecording = useCallback(() => {
        setRecordingState((prev) => {
            if (prev?.originalSize) {
                dispatchCanvas({
                    type: ActionType.SIZE,
                    width: prev.originalSize.width,
                    height: prev.originalSize.height,
                });
                dispatchCanvas({ type: ActionType.POINT_SIZES, pointSize: prev.originalSize.pointSize });
            }
            return null;
        });
    }, [dispatchCanvas]);

    const getTrackDownloadData = () => {
        const trackData: TrackDownloadData[] = [];

        // Build a reverse map from pointId → {trackID, track} for O(1) lookup
        const pointIdToTrack = new Map<
            number,
            { trackID: number; track: typeof canvas.tracks extends Map<infer _K, infer V> ? V : never }
        >();
        canvas.tracks.forEach((track, trackID) => {
            for (const pointId of track.threeTrack.pointIds) {
                pointIdToTrack.set(pointId, { trackID, track });
            }
        });

        canvas.selectedPointIds.forEach((pointId) => {
            const time = Math.floor(pointId / canvas.maxPointsPerTimepoint);
            const entry = pointIdToTrack.get(pointId);
            if (!entry) return;
            const { trackID, track } = entry;
            const pointIndex = track.threeTrack.pointIds.indexOf(pointId);
            if (pointIndex === -1) return;
            // The track is a LineSegmentsGeometry: N points → N-1 segments, so
            // instanceStart only has N-1 entries (one per segment start). The last
            // point of a track has no instanceStart entry — read it from instanceEnd
            // (the end vertex of the final segment) instead, otherwise it reads NaN.
            const instanceStart = track.threeTrack.geometry.getAttribute("instanceStart");
            const instanceEnd = track.threeTrack.geometry.getAttribute("instanceEnd");
            const isLastPoint = pointIndex === track.threeTrack.pointIds.length - 1;
            const positions = isLastPoint && pointIndex > 0 ? instanceEnd : instanceStart;
            const posIndex = isLastPoint && pointIndex > 0 ? pointIndex - 1 : pointIndex;
            trackData.push([
                trackID + 1,
                time,
                positions.getX(posIndex),
                positions.getY(posIndex),
                positions.getZ(posIndex),
                track.parentTrackID,
            ]);
        });

        // Sort the trackData by track ID (first column) and then by time (second column)
        trackData.sort((a, b) => {
            if (a[0] !== b[0]) return a[0] - b[0];
            return a[1] - b[1];
        });

        // Round to 3 decimal places
        const formatter = Intl.NumberFormat("en-US", { useGrouping: false });
        return trackData.map((row) => row.map(formatter.format));
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "row", width: "100%", height: "100%", overflow: "hidden" }}>
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
                        <Box
                            sx={{
                                flexGrow: 1, // CHANGED: Allows the middle section to expand
                                overflowY: "auto", // CHANGED: Makes this section scrollable
                                overflowX: "hidden",
                                padding: "2em",
                            }}
                        >
                            <CellControls
                                clearTracks={() => {
                                    dispatchCanvas({ type: ActionType.REMOVE_ALL_TRACKS });
                                }}
                                getTrackDownloadData={getTrackDownloadData}
                                numSelectedCells={numSelectedCells}
                                numSelectedTracks={numSelectedTracks}
                                trackManager={trackManager}
                                selectionMode={canvas.selector.selectionMode}
                                setSelectionMode={(value: PointSelectionMode) => {
                                    dispatchCanvas({ type: ActionType.SELECTION_MODE, selectionMode: value });
                                }}
                                detectedDevice={deviceState}
                                MobileSelectCells={() => {
                                    dispatchCanvas({ type: ActionType.MOBILE_SELECT_CELLS });
                                }}
                                setSelectorScale={(scale: number) => {
                                    dispatchCanvas({ type: ActionType.SELECTOR_SCALE, scale });
                                }}
                                selectorScale={canvas.selector.sphereSelector.cursor.scale.x}
                                colorBy={canvas.colorBy}
                                colorByEvent={canvas.colorByEvent}
                                colorBySecondEvent={canvas.colorBySecondEvent}
                                onSelectBinaryValue={(pointIds: Set<number>) => {
                                    dispatchCanvas({
                                        type: ActionType.ADD_SELECTED_POINT_IDS,
                                        selectedPointIndices: [],
                                        selectedPointIds: pointIds,
                                    });
                                }}
                                onLoadTissueTracks={handleTissueTracks}
                            />
                            <Divider sx={{ marginY: "1em" }} />
                            <LeftSidebarWrapper
                                hasTracks={numSelectedCells > 0 || numSelectedTracks > 0}
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
                                isTablet={detectedDevice.isTablet}
                                canvas={canvas}
                                setPointBrightness={(brightness: number) => {
                                    dispatchCanvas({ type: ActionType.POINT_BRIGHTNESS, brightness });
                                }}
                                setPointSize={(pointSize: number) => {
                                    dispatchCanvas({ type: ActionType.POINT_SIZES, pointSize });
                                }}
                                setTrackWidth={(factor: number) => {
                                    dispatchCanvas({
                                        type: ActionType.TRACK_WIDTH,
                                        factor,
                                    });
                                }}
                                axesVisible={canvas.showAxes}
                                toggleAxesVisible={() => {
                                    dispatchCanvas({ type: ActionType.TOGGLE_AXES });
                                }}
                                colorBy={canvas.colorBy}
                                toggleColorBy={(colorBy: boolean) => {
                                    dispatchCanvas({ type: ActionType.TOGGLE_COLOR_BY, colorBy });
                                }}
                                colorByEvent={canvas.colorByEvent}
                                changeColorBy={(option: Option) => {
                                    dispatchCanvas({ type: ActionType.CHANGE_COLOR_BY, option });
                                }}
                                colorBySecondEvent={canvas.colorBySecondEvent}
                                changeSecondColorBy={(option: Option | null) => {
                                    dispatchCanvas({ type: ActionType.CHANGE_SECOND_COLOR_BY, option });
                                }}
                                colormapTracks={canvas.colormapTracks}
                                setColormapTracks={(colormapName: string) => {
                                    dispatchCanvas({ type: ActionType.CHANGE_COLORMAP_TRACKS, colormapName });
                                }}
                                colormapCells={
                                    canvas.colorByEvent.type === "categorical"
                                        ? canvas.colormapCellsCategorical
                                        : canvas.colormapCellsContinuous
                                }
                                setColormapCells={(colormapName: string) => {
                                    dispatchCanvas({
                                        type: ActionType.CHANGE_COLORMAP_CELLS,
                                        colormapName,
                                        attributeType: canvas.colorByEvent.type as "categorical" | "continuous",
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
                                actionsUponNewData={actionsUponNewData}
                                copyShareableUrlToClipboard={copyShareableUrlToClipboard}
                                refreshPage={refreshPage}
                                trackManager={trackManager}
                            />
                        </Box>
                    </Box>
                </Drawer>
            )}
            {/* Box for Scene + playBackControls */}
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    flexGrow: 1,
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                }}
            >
                {/* The canvas (Scene + colormap + timestamp) */}
                <Box
                    ref={sceneDivRef}
                    sx={{
                        flexGrow: 1,
                        width: "100%",
                        height: "100%",
                        overflow: "hidden",
                        position: "relative", // Add this to make ColorMap and TimestampOverlay relative to the canvas
                    }}
                >
                    <Scene isLoading={isLoadingPoints || numLoadingTracks > 0} />
                    {/* <TimestampOverlay timestamp={canvas.curTime} /> */}
                    {hoveredTissue && (
                        <TissueHoverOverlay name={hoveredTissue.name} hexColor={hoveredTissue.hexColor} />
                    )}
                    {numSelectedCells > 0 && <ColorMapTracks colormapName={canvas.colormapTracks} />}
                    {canvas.colorByEvent.type !== "default" &&
                        canvas.colorByEvent.type !== "hex" &&
                        canvas.colorByEvent.type !== "hex-binary" && (
                            <ColorMapCells
                                colorByEvent={canvas.colorByEvent}
                                colormapName={
                                    canvas.colorByEvent.type === "categorical"
                                        ? canvas.colormapCellsCategorical
                                        : canvas.colormapCellsContinuous
                                }
                            />
                        )}
                </Box>

                {/* The playback controls */}
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        flexGrow: 1,
                        padding: ".5em",
                        height: detectedDevice.isMobile ? "150px" : "50px", // leaving extra space for mobile
                        paddingLeft: 0,
                    }}
                >
                    <Box sx={{ flexGrow: 1 }}>
                        <PlaybackControls
                            enabledPlaySlider={true}
                            enabledRotation={trackManager?.ndim === 3}
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
                    {!detectedDevice.isPhone && (
                        <SaveVideoButton
                            numTimes={numTimes}
                            playbackFPS={playbackFPS}
                            recordingState={recordingState}
                            onStartRecording={startRecording}
                            onCancelRecording={cancelRecording}
                            dataUrl={dataUrl}
                        />
                    )}
                </Box>
            </Box>
            <WarningDialog
                open={showWarningDialog}
                numUnfetchedPoints={numUnfetchedPoints}
                message={warningMessage}
                onCloseAction={() => {
                    setShowWarningDialog(false);
                    setWarningMessage(undefined);
                    pendingCancelAction?.();
                    setPendingCancelAction(null);
                }}
                onContinueAction={() => {
                    setShowWarningDialog(false);
                    setWarningMessage(undefined);
                    pendingTrackLoader?.();
                    setPendingTrackLoader(null);
                }}
            />
        </Box>
    );
}
