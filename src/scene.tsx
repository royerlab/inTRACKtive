import { useEffect, useRef, useState } from "react";
import { InputSlider, InputText, InputToggle } from "@czi-sds/components";
import { PointCanvas } from "./PointCanvas";
import { TrackManager, loadTrackManager } from "./TrackManager";

// @ts-expect-error - types for zarr are not working right now, but a PR is open https://github.com/gzuidhof/zarr.js/pull/149
import { ZarrArray } from "zarr";
import useSelectionBox from "./hooks/useSelectionBox";

// const DEFAULT_ZARR_URL = new URL(
//     "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/tracks_benchmark/ZSNS001_nodes.zarr",
// );

const DEFAULT_ZARR_URL = new URL("http://localhost:8000/ZSNS001_points.zarr");
interface SceneProps {
    renderWidth: number;
    renderHeight?: number;
}

export default function Scene(props: SceneProps) {
    const renderWidth = props.renderWidth || 800;
    const renderHeight = props.renderHeight || 600;

    const [trackManager, setTrackManager] = useState<TrackManager>();
    const [dataUrl, setDataUrl] = useState(DEFAULT_ZARR_URL);
    const [numTimes, setNumTimes] = useState(0);
    const [curTime, setCurTime] = useState(0);
    const [autoRotate, setAutoRotate] = useState(false);
    const [playing, setPlaying] = useState(false);

    // Use references here for two things:
    // * manage objects that should never change, even when the component re-renders
    // * avoid triggering re-renders when these *do* change
    const divRef: React.RefObject<HTMLDivElement> = useRef(null);
    const canvas = useRef<PointCanvas>();
    const { selectedPoints, setSelectedPoints } = useSelectionBox(canvas.current);

    // this useEffect is intended to make this part run only on mount
    // this requires keeping the dependency array empty
    useEffect(() => {
        // initialize the canvas
        canvas.current = new PointCanvas(renderWidth, renderHeight);

        // append renderer canvas
        const divCurrent = divRef.current;
        const renderer = canvas.current!.renderer;
        divCurrent?.appendChild(renderer.domElement);

        // start animating - this keeps the scene rendering when controls change, etc.
        canvas.current.animate();

        return () => {
            renderer.domElement.remove();
            canvas.current?.dispose();
        };
    }, []); // dependency array must be empty to run only on mount!

    useEffect(() => {
        console.log("selected points: %s", selectedPoints);
        const pointsID = canvas.current?.points.id || 0;
        if (!selectedPoints || !(pointsID in selectedPoints)) return;
        const maxPointsPerTimepoint = trackManager?.points?.shape[1] / 3 || 0;
        // TODO: this is re-fetching old data as well, need to get the diff of selectedPoints
        for (const p of selectedPoints[pointsID]) {
            const pointID = curTime * maxPointsPerTimepoint + p;
            trackManager?.fetchTrackIDsForPoint(pointID).then((tracks) => {
                for (const t of tracks) {
                    if (canvas.current && t in canvas.current.tracks) continue;
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
        const pathParts = dataUrl.pathname.split("/");
        const path = pathParts.pop() || "";
        const store = dataUrl.origin + pathParts.join("/");
        const trackManager = loadTrackManager(store, path);
        // TODO: add clean-up by returning another closure
        trackManager.then((tm: ZarrArray) => {
            setTrackManager(tm);
            setNumTimes(tm.points.shape[0]);
            setCurTime(0);
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
        setSelectedPoints({});
        let ignore = false;
        // TODO: this is a very basic attempt to prevent stale data
        // in addition, we should debounce the input and verify the data is current
        // before rendering it
        if (trackManager && !ignore) {
            // trackManager.highlightTracks(curTime);
            console.debug("fetch points at time %d", curTime);
            // fetchPointsAtTime(array, curTime).then((data) => {
            trackManager?.getPointsAtTime(curTime).then((data) => {
                console.debug("got %d points for time %d", data.length / 3, curTime);
                if (ignore) {
                    console.debug("IGNORE SET points at time %d", curTime);
                    return;
                }
                canvas.current?.setPointsPositions(data);
            });
        } else {
            console.debug("IGNORE FETCH points at time %d", curTime);
        }
        return () => {
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
                        disabled={trackManager === undefined}
                        onChange={(e) => {
                            setAutoRotate((e.target as HTMLInputElement).checked);
                        }}
                    />
                    <InputToggle
                        onLabel="Play"
                        offLabel="Play"
                        disabled={trackManager === undefined}
                        onChange={(e) => {
                            setPlaying((e.target as HTMLInputElement).checked);
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
