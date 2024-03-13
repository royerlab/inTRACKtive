import { useEffect, useRef, useState } from "react";
import { Button, InputSlider, InputText, InputToggle, LoadingIndicator } from "@czi-sds/components";
import { PointCanvas } from "./PointCanvas";
import { TrackManager, loadTrackManager } from "./TrackManager";

import useSelectionBox from "./hooks/useSelectionBox";

import { ViewerState, clearUrlHash } from "./ViewerState";

interface SceneProps {
    renderWidth?: number;
    renderHeight?: number;
}

// Ideally we do this here so that we can use initial values as default values for React state.
const initialViewerState = ViewerState.fromUrlHash(window.location.hash);
console.log("initial viewer state: %s", JSON.stringify(initialViewerState));
clearUrlHash();

export default function Scene(props: SceneProps) {
    const renderWidth = props.renderWidth || 800;
    const renderHeight = props.renderHeight || 600;

    // Use references here for two things:
    // * manage objects that should never change, even when the component re-renders
    // * avoid triggering re-renders when these *do* change
    const divRef: React.RefObject<HTMLDivElement> = useRef(null);
    const canvas = useRef<PointCanvas>();

    // Primary state that determines configuration of application.
    const [dataUrl, setDataUrl] = useState(initialViewerState.dataUrl);
    const [curTime, setCurTime] = useState(initialViewerState.curTime);
    const [autoRotate, setAutoRotate] = useState(false);
    const [playing, setPlaying] = useState(false);

    // Other state that is not or does not need to be persisted.
    const [trackManager, setTrackManager] = useState<TrackManager | null>(null);
    const [numTimes, setNumTimes] = useState(0);
    const [trackHighlightLength, setTrackHighlightLength] = useState(11);
    const [loading, setLoading] = useState(false);
    const { selectedPoints } = useSelectionBox(canvas.current);

    // Manage shareable state than can persist across sessions.
    const copyShareableUrlToClipboard = () => {
        const state = new ViewerState(
            dataUrl,
            curTime,
            canvas.current!.camera.position,
            canvas.current!.controls.target,
        );
        const url = window.location.toString() + "#" + state.toUrlHash();
        navigator.clipboard.writeText(url);
    };
    const setStateFromHash = () => {
        const state = ViewerState.fromUrlHash(window.location.hash);
        clearUrlHash();
        setDataUrl(state.dataUrl);
        setCurTime(state.curTime);
        canvas.current?.setCameraProperties(state.cameraPosition, state.cameraTarget);
    };

    // this useEffect is intended to make this part run only on mount
    // this requires keeping the dependency array empty
    useEffect(() => {
        // initialize the canvas
        canvas.current = new PointCanvas(renderWidth, renderHeight);
        canvas.current!.setCameraProperties(initialViewerState.cameraPosition, initialViewerState.cameraTarget);

        // handle any changes to the hash after the initial document has loaded
        window.addEventListener("hashchange", setStateFromHash);

        // append renderer canvas
        const divCurrent = divRef.current;
        const renderer = canvas.current!.renderer;
        divCurrent?.appendChild(renderer.domElement);

        // start animating - this keeps the scene rendering when controls change, etc.
        canvas.current.animate();

        return () => {
            window.removeEventListener("hashchange", setStateFromHash);
            renderer.domElement.remove();
            canvas.current?.dispose();
        };
    }, []); // dependency array must be empty to run only on mount!

    useEffect(() => {
        const pointsID = canvas.current?.points.id || -1;
        if (!selectedPoints || !selectedPoints.has(pointsID)) return;
        // keep track of which tracks we are adding to avoid duplicate fetching
        const adding = new Set<number>();

        // this fetches the entire lineage for each track
        const fetchAndAddTrack = async (pointID: number) => {
            if (!canvas.current || !trackManager) return;
            const minTime = curTime - trackHighlightLength / 2;
            const maxTime = curTime + trackHighlightLength / 2;
            const tracks = await trackManager.fetchTrackIDsForPoint(pointID);
            // TODO: points actually only belong to one track, so can get rid of the outer loop
            for (const t of tracks) {
                const lineage = await trackManager.fetchLineageForTrack(t);
                for (const l of lineage) {
                    if (adding.has(l) || canvas.current.tracks.has(l)) continue;
                    adding.add(l);
                    const [pos, ids] = await trackManager.fetchPointsForTrack(l);
                    const newTrack = canvas.current.addTrack(l, pos, ids);
                    newTrack?.updateHighlightLine(minTime, maxTime);
                }
            }
        };

        const selected = selectedPoints.get(pointsID) || [];
        canvas.current?.highlightPoints(selected);

        const maxPointsPerTimepoint = trackManager?.maxPointsPerTimepoint || 0;
        Promise.all(selected.map((p) => curTime * maxPointsPerTimepoint + p).map(fetchAndAddTrack));
        // TODO: cancel the fetch if the selection changes?
    }, [selectedPoints]);

    // update the array when the dataUrl changes
    useEffect(() => {
        console.log("load data from %s", dataUrl);
        const trackManager = loadTrackManager(dataUrl.toString());
        // TODO: add clean-up by returning another closure
        trackManager.then((tm: TrackManager | null) => {
            setTrackManager(tm);
            setNumTimes(tm?.points.shape[0] || numTimes);
            // Defend against the case when a curTime valid for previous data
            // is no longer valid.
            setCurTime(Math.min(curTime, tm?.points.shape[0] - 1 || Infinity));
        });
    }, [dataUrl]);

    // set the controls to auto-rotate
    useEffect(() => {
        canvas.current && (canvas.current.controls.autoRotate = autoRotate);
    }, [autoRotate]);

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
    }, [numTimes, curTime, playing]);

    // update the geometry buffers when the array changes
    useEffect(() => {
        if (!trackManager || !canvas.current) return;
        canvas.current.initPointsGeometry(trackManager.maxPointsPerTimepoint);
    }, [trackManager]);

    // update the points when the array or timepoint changes
    useEffect(() => {
        // show a loading indicator if the fetch takes longer than 10ms (avoid flicker)
        const loadingTimer = setTimeout(() => setLoading(true), 10);
        let ignore = false;
        // TODO: this is a very basic attempt to prevent stale data
        // in addition, we should debounce the input and verify the data is current
        // before rendering it
        if (canvas.current && trackManager && !ignore) {
            const getPoints = async (canvas: PointCanvas, time: number) => {
                console.debug("fetch points at time %d", time);
                const data = await trackManager.fetchPointsAtTime(time);
                console.debug("got %d points for time %d", data.length / 3, time);

                if (ignore) {
                    console.debug("IGNORE SET points at time %d", time);
                    return;
                }

                clearTimeout(loadingTimer);
                setLoading(false);
                canvas.setPointsPositions(data);
                canvas.resetPointColors();
            };
            getPoints(canvas.current, curTime);
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
        // update the track highlights
        const minTime = curTime - trackHighlightLength / 2;
        const maxTime = curTime + trackHighlightLength / 2;
        canvas.current?.updateAllTrackHighlights(minTime, maxTime);
    }, [curTime, trackHighlightLength]);

    // update the renderer and composer when the render size changes
    // TODO: check performance and avoid if unchanged
    canvas.current?.setSize(renderWidth, renderHeight);

    // set up marks for the time slider
    const spacing = 100;
    const marks = [...Array(Math.round(numTimes / spacing)).keys()].map((i) => ({
        value: i * spacing,
        label: i * spacing,
    }));
    marks.push({ value: numTimes - 1, label: numTimes - 1 });

    return (
        <div>
            <div ref={divRef}>
                <div className="inputcontainer">
                    <InputText
                        id="url-input"
                        label="Zarr URL"
                        placeholder={initialViewerState.dataUrl.toString()}
                        defaultValue={initialViewerState.dataUrl.toString()}
                        onChange={(e) => {
                            const urlString = e.target.value;
                            let url;
                            try {
                                url = new URL(urlString);
                            } catch (error) {
                                if (urlString.length > 0) {
                                    console.error("Failed to parse URL %s:", e.target.value);
                                }
                                setTrackManager(null);
                                return;
                            }
                            setDataUrl(url);
                        }}
                        fullWidth={true}
                        intent={trackManager ? "default" : "error"}
                    />
                    <InputSlider
                        id="time-frame-slider"
                        aria-labelledby="input-slider-time-frame"
                        disabled={!trackManager}
                        min={0}
                        max={numTimes - 1}
                        valueLabelDisplay="on"
                        onChange={(_, value) => setCurTime(value as number)}
                        marks={marks}
                        value={curTime}
                    />
                    <InputSlider
                        id="track-highlight-length-slider"
                        aria-labelledby="input-slider-track-highlight-length"
                        disabled={trackManager === undefined}
                        min={0}
                        max={numTimes - 1}
                        valueLabelDisplay="on"
                        onChange={(_, value) => setTrackHighlightLength(value as number)}
                        marks={marks}
                        value={trackHighlightLength}
                    />
                    <div className="buttoncontainer">
                        <InputToggle
                            onLabel="Spin"
                            offLabel="Spin"
                            checked={autoRotate}
                            disabled={!trackManager}
                            onChange={(e) => {
                                setAutoRotate((e.target as HTMLInputElement).checked);
                            }}
                        />
                        <InputToggle
                            onLabel="Play"
                            offLabel="Play"
                            checked={playing}
                            disabled={!trackManager}
                            onChange={(e) => {
                                setPlaying((e.target as HTMLInputElement).checked);
                            }}
                        />
                        <Button
                            disabled={!trackManager}
                            sdsType="primary"
                            sdsStyle="rounded"
                            onClick={() => canvas.current?.removeAllTracks()}
                        >
                            Clear Tracks
                        </Button>
                        <Button
                            disabled={canvas.current === undefined}
                            sdsType="primary"
                            sdsStyle="rounded"
                            onClick={copyShareableUrlToClipboard}
                        >
                            Copy Link
                        </Button>
                    </div>
                </div>
            </div>
            {loading && <LoadingIndicator sdsStyle="minimal" />}
        </div>
    );
}
