import { useEffect, useRef, useState } from "react";
import { Button, InputSlider, InputText, InputToggle } from "@czi-sds/components";
import { PointCanvas } from "./PointCanvas";
import { TrackManager, loadTrackManager } from "./TrackManager";

// @ts-expect-error - types for zarr are not working right now, but a PR is open https://github.com/gzuidhof/zarr.js/pull/149
import { ZarrArray } from "zarr";
import useSelectionBox from "./hooks/useSelectionBox";

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
        console.debug("selected points: %s", selectedPoints);
        const pointsID = canvas.current?.points.id || 0;
        if (!selectedPoints || !selectedPoints.has(pointsID)) return;
        const maxPointsPerTimepoint = trackManager?.points?.shape[1] / 3 || 0;

        // TODO: use Promise.all to fetch all tracks in parallel
        const fetchAndAddTrack = async (pointID: number) => {
            const tracks = (await trackManager?.fetchTrackIDsForPoint(pointID)) || Int32Array.from([]);
            for (const t of tracks) {
                const lineage = (await trackManager?.fetchLineageForTrack(t)) || Int32Array.from([]);
                for (const l of lineage) {
                    if (canvas.current && canvas.current.tracks.has(l)) continue;
                    const [pos, ids] = (await trackManager?.fetchPointsForTrack(l)) || [
                        Float32Array.from([]),
                        Int32Array.from([]),
                    ];
                    pos && canvas.current?.addTrack(l, pos, ids);
                    canvas.current?.updateTrackColors(l, curTime - 5, curTime + 5, curTime);
                }
            }
        };
        // TODO: this is re-fetching old data as well, need to get the diff of selectedPoints
        const selected = selectedPoints.get(pointsID) || [];
        console.log("selected points: %s", selected);

        canvas.current?.highlightPoints(selected);
        console.log(selected);
        for (const p of selected) {
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
        canvas.current && (canvas.current.maxPointsPerTimepoint = trackManager.maxPointsPerTimepoint);
    }, [trackManager]);

    // update the points when the array or timepoint changes
    useEffect(() => {
        // setSelectedPoints(new Map());
        let ignore = false;
        // TODO: this is a very basic attempt to prevent stale data
        // in addition, we should debounce the input and verify the data is current
        // before rendering it
        if (canvas.current && trackManager && !ignore) {
            const getAndHighlightPoints = async (canvas: PointCanvas, time: number) => {
                console.debug("fetch points at time %d", time);
                const data = await trackManager.fetchPointsAtTime(time);
                console.debug("got %d points for time %d", data.length / 3, time);

                if (ignore) {
                    console.debug("IGNORE SET points at time %d", time);
                    return;
                }

                canvas.setPointsPositions(data);
                canvas.resetPointColors();
                canvas.updateAllTrackColors(curTime);
            };
            getAndHighlightPoints(canvas.current, curTime);
        } else {
            console.debug("IGNORE FETCH points at time %d", curTime);
        }
        return () => {
            ignore = true;
        };
    }, [trackManager, curTime]);

    useEffect(() => {
        if (canvas.current && trackManager) {
            const pointsGeometry = canvas.current.points.geometry;
            let target = { x: 0, y: 0, z: 0 };
            if (pointsGeometry.boundingSphere) {
                target = pointsGeometry.boundingSphere.center;
            }
            console.log("target: %o", target);
            canvas.current.camera.position.set(target.x, target.y, target.z - 1500);
            canvas.current.camera.lookAt(target.x, target.y, target.z);
        }
    }, [trackManager]);

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
                    <Button
                        disabled={trackManager === undefined}
                        sdsType="primary"
                        sdsStyle="rounded"
                        onClick={() => canvas.current?.removeAllTracks()}
                    >
                        Clear Tracks
                    </Button>
                </div>
            </div>
        </div>
    );
}
