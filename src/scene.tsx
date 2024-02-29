import { useEffect, useRef, useState } from "react";
import { Button, InputSlider, InputText, InputToggle, LoadingIndicator } from "@czi-sds/components";
import { PointCanvas } from "./PointCanvas";
import { TrackManager, loadTrackManager } from "./TrackManager";

// @ts-expect-error - types for zarr are not working right now, but a PR is open https://github.com/gzuidhof/zarr.js/pull/149
import { ZarrArray } from "zarr";
import useSelectionBox from "./hooks/useSelectionBox";
import { getStateFromUrlHash, reuseStateInUrlHash, setStateInUrlHash, useStateInUrlHash } from "./hooks/useUrlHash";

const DEFAULT_ZARR_URL = new URL(
    "https://sci-imaging-vis-public-demo-data.s3.us-west-2.amazonaws.com" +
        "/points-web-viewer/sparse-zarr-v2/ZSNS001_tracks_bundle.zarr",
);
interface SceneProps {
    renderWidth?: number;
    renderHeight?: number;
}

export default function Scene(props: SceneProps) {
    const renderWidth = props.renderWidth || 800;
    const renderHeight = props.renderHeight || 600;

    // Use references here for two things:
    // * manage objects that should never change, even when the component re-renders
    // * avoid triggering re-renders when these *do* change
    const divRef: React.RefObject<HTMLDivElement> = useRef(null);
    const canvas = useRef<PointCanvas>();

    // Primary state that determines configuration of application.
    // This is persisted in the URL for easy sharing.
    const [dataUrl, setDataUrl] = useStateInUrlHash("dataUrl", DEFAULT_ZARR_URL);
    const [curTime, setCurTime] = useStateInUrlHash("curTime", 0);
    const [autoRotate, setAutoRotate] = useStateInUrlHash("autoRotate", false);
    const [playing, setPlaying] = useStateInUrlHash("playing", false);
    const initialValue = getStateFromUrlHash("selectedPoints", {});
    const selectionBox = useSelectionBox(canvas.current, initialValue);
    const [selectedPoints, setSelectedPoints] = reuseStateInUrlHash("selectedPoints", selectionBox.selectedPoints, selectionBox.setSelectedPoints);

    // Derived state that does not need to be persisted.
    const [trackManager, setTrackManager] = useState<TrackManager>();
    const [numTimes, setNumTimes] = useState(0);
    const [loading, setLoading] = useState(false);

    // The current state changes and async fetches don't make a good model
    // for initialization from existing viewer configs (e.g. that come from the URL).
    // That's because most of the viewer config is react state, some of which is
    // dependent on the timing and order of async effects. For example, selectedPoints
    // is React state that is dependent on the three.js points that are being displayed.
    // On initialization, we might have a non-empty selection because won't have fetched
    // or displayed the points in three.js yet.
    // We could store some extra last<X> values to keep track of changes, but that feels
    // like we're doing our own React state management.
    // If a fetch were triggered by adding a selection object to the PointsCanvas instead,
    // then this could likely be done synchronously.
    // That way we could add selections to the canvas explicitly and synchronously rather
    // than relying on pointerup (pointerup could call that instead?).
    
    // I'm not sure how to capture non-react state in the URL with the current approach,
    // which relies on React effects to update the URL (and set the state from the URL).
    // For example, take the three.js camera/controls.
    // It's fairly easy to listen to value changes to something like this (e.g. controls),
    // and we can update the URL hash when those occur.

    // this useEffect is intended to make this part run only on mount
    // this requires keeping the dependency array empty
    useEffect(() => {
        // initialize the canvas
        canvas.current = new PointCanvas(renderWidth, renderHeight);

        const onControlsChange = (event) => {
            const controls = event.target;
            setStateInUrlHash("cameraPosition", controls.object.position);
            setStateInUrlHash("cameraTarget", controls.target);
        };
        canvas.current.controls.addEventListener('change', onControlsChange);

        // append renderer canvas
        const divCurrent = divRef.current;
        const renderer = canvas.current!.renderer;
        divCurrent?.appendChild(renderer.domElement);

        // start animating - this keeps the scene rendering when controls change, etc.
        canvas.current.animate();

        return () => {
            renderer.domElement.remove();
            canvas.current?.dispose();
            canvas.current?.controls.removeEventListener('change', onControlsChange);
        };
    }, []); // dependency array must be empty to run only on mount!

    useEffect(() => {
        console.log("selected points: %s", JSON.stringify(selectedPoints));
        const pointsID = canvas.current?.points.id || 0;
        if (!selectedPoints || !(pointsID in selectedPoints)) return;
        const maxPointsPerTimepoint = trackManager?.points?.shape[1] / 3 || 0;
        // TODO: this is re-fetching old data as well, need to get the diff of selectedPoints
        for (const p of selectedPoints[pointsID]) {
            const pointID = curTime * maxPointsPerTimepoint + p;
            trackManager?.fetchTrackIDsForPoint(pointID).then((tracks) => {
                for (const t of tracks) {
                    if (canvas.current && canvas.current.tracks.has(t)) continue;
                    trackManager.fetchPointsForTrack(t).then((points) => {
                        canvas.current?.addTrack(t, points);
                    });
                }
            });
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
        // show a loading indicator if the fetch takes longer than 10ms (avoid flicker)
        const loadingTimer = setTimeout(() => setLoading(true), 10);
        let ignore = false;
        // TODO: this is a very basic attempt to prevent stale data
        // in addition, we should debounce the input and verify the data is current
        // before rendering it
        if (trackManager && !ignore) {
            console.debug("fetch points at time %d", curTime);
            trackManager?.getPointsAtTime(curTime).then((data) => {
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
                            onClick={() => {setSelectedPoints({}); canvas.current?.removeAllTracks()}}
                        >
                            Clear Tracks
                        </Button>
                    </div>
                </div>
            </div>
            {loading && <LoadingIndicator sdsStyle="minimal" />}
        </div>
    );
}
