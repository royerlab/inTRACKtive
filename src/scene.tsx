import { useEffect, useRef, useState } from "react";
import { Button, InputSlider, InputText, InputToggle, LoadingIndicator } from "@czi-sds/components";
import { PointCanvas } from "./PointCanvas";
import { TrackManager, loadTrackManager } from "./TrackManager";

// @ts-expect-error - types for zarr are not working right now, but a PR is open https://github.com/gzuidhof/zarr.js/pull/149
import { ZarrArray } from "zarr";
import useSelectionBox from "./hooks/useSelectionBox";

import { DEFAULT_ZARR_URL, ViewerState } from "./ViewerState";

interface SceneProps {
    renderWidth?: number;
    renderHeight?: number;
}

// Ideally we do this here so that we can use initial values as default values for React state.
const initialViewerState = ViewerState.fromUrlHash();
console.log("initial viewer state: %s", JSON.stringify(initialViewerState));

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
    const [autoRotate, setAutoRotate] = useState(initialViewerState.autoRotate);
    const [playing, setPlaying] = useState(initialViewerState.playing);

    // Other state that is not or does not need to be persisted.
    const [trackManager, setTrackManager] = useState<TrackManager>();
    const [numTimes, setNumTimes] = useState(0);
    const [loading, setLoading] = useState(false);
    const { selectedPoints, setSelectedPoints } = useSelectionBox(canvas.current);

    // Manage shareable state than can persist across sessions.
    const copyShareableUrlToClipboard = () => {
        const state = new ViewerState(
            dataUrl,
            curTime,
            autoRotate,
            playing,
            canvas.current!.camera.position,
            canvas.current!.controls.target,
        );
        const url = window.location.toString() + "#" + state.toUrlHash();
        navigator.clipboard.writeText(url);
    };
    const setStateFromHash = () => {
        const state = ViewerState.fromUrlHash();
        setDataUrl(state.dataUrl);
        setCurTime(state.curTime);
        setAutoRotate(state.autoRotate);
        setPlaying(state.playing);
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
        console.debug("selected points: %s", selectedPoints);
        const pointsID = canvas.current?.points.id || 0;
        if (!selectedPoints || !(pointsID in selectedPoints)) return;
        const maxPointsPerTimepoint = trackManager?.points?.shape[1] / 3 || 0;

        // TODO: use Promise.all to fetch all tracks in parallel
        const fetchAndAddTrack = async (pointID: number) => {
            const tracks = (await trackManager?.fetchTrackIDsForPoint(pointID)) || Int32Array.from([]);
            for (const t of tracks) {
                const lineage = (await trackManager?.fetchLineageForTrack(t)) || Int32Array.from([]);
                for (const l of lineage) {
                    if (canvas.current && canvas.current.tracks.has(l)) continue;
                    const points = await trackManager?.fetchPointsForTrack(l);
                    points && canvas.current?.addTrack(l, points);
                }
            }
        };

        // TODO: this is re-fetching old data as well, need to get the diff of selectedPoints
        for (const p of selectedPoints[pointsID]) {
            const pointID = curTime * maxPointsPerTimepoint + p;
            fetchAndAddTrack(pointID);
        }
    }, [selectedPoints]);

    // update the array when the dataUrl changes
    useEffect(() => {
        console.log("load data from %s", dataUrl);
        const trackManager = loadTrackManager(dataUrl.toString());
        // TODO: add clean-up by returning another closure
        trackManager.then((tm: ZarrArray) => {
            setTrackManager(tm);
            setNumTimes(tm.points.shape[0]);
            setCurTime(curTime);
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
        if (!trackManager) return;
        canvas.current?.initPointsGeometry(trackManager.points.shape[1] / 3);
    }, [trackManager]);

    // update the points when the array or timepoint changes
    useEffect(() => {
        // TODO: update the selected points instead of clearing them
        setSelectedPoints({});
        // show a loading indicator if the fetch takes longer than 10ms (avoid flicker)
        const loadingTimer = setTimeout(() => setLoading(true), 10);
        let ignore = false;
        // TODO: this is a very basic attempt to prevent stale data
        // in addition, we should debounce the input and verify the data is current
        // before rendering it
        if (trackManager && !ignore) {
            console.debug("fetch points at time %d", curTime);
            trackManager?.fetchPointsAtTime(curTime).then((data) => {
                console.debug("got %d points for time %d", data.length / 3, curTime);
                if (ignore) {
                    console.debug("IGNORE SET points at time %d", curTime);
                    return;
                }
                clearTimeout(loadingTimer);
                setLoading(false);
                canvas.current?.setPointsPositions(data);
            });
        } else {
            clearTimeout(loadingTimer);
            setLoading(false);
            console.debug("IGNORE FETCH points at time %d", curTime);
        }
        return () => {
            clearTimeout(loadingTimer);
            ignore = true;
        };
    }, [trackManager, curTime]);

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
                        placeholder={DEFAULT_ZARR_URL.toString()}
                        value={dataUrl.toString()}
                        onChange={(e) => setDataUrl(new URL(e.target.value))}
                        fullWidth={true}
                        intent={trackManager ? "default" : "error"}
                    />
                    <InputSlider
                        id="time-frame-slider"
                        aria-labelledby="input-slider-time-frame"
                        disabled={trackManager === undefined}
                        min={0}
                        max={numTimes - 1}
                        valueLabelDisplay="on"
                        onChange={(_, value) => setCurTime(value as number)}
                        marks={marks}
                        value={curTime}
                    />
                    <div className="buttoncontainer">
                        <InputToggle
                            onLabel="Spin"
                            offLabel="Spin"
                            checked={autoRotate}
                            disabled={trackManager === undefined}
                            onChange={(e) => {
                                setAutoRotate((e.target as HTMLInputElement).checked);
                            }}
                        />
                        <InputToggle
                            onLabel="Play"
                            offLabel="Play"
                            checked={playing}
                            disabled={trackManager === undefined}
                            onChange={(e) => {
                                setPlaying((e.target as HTMLInputElement).checked);
                            }}
                        />
                        <Button
                            disabled={trackManager === undefined}
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
