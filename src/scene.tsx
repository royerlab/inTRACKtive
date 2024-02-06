import { useEffect, useRef, useState } from "react";
import { InputSlider, InputText, InputToggle } from "@czi-sds/components";
import { PointCanvas } from "./PointCanvas";

// @ts-expect-error - types for zarr are not working right now, but a PR is open https://github.com/gzuidhof/zarr.js/pull/149
import { ZarrArray, slice, openArray } from "zarr";
import useSelectionBox from "./hooks/useSelectionBox";
import { PointsCollection } from "./PointSelectionBox";

const DEFAULT_ZARR_URL = new URL("http://127.0.0.1:8000/data.zarr/");

interface SceneProps {
    renderWidth: number;
    renderHeight?: number;
}

export default function Scene(props: SceneProps) {
    const renderWidth = props.renderWidth || 800;
    const renderHeight = props.renderHeight || 600;

    const [timeArray, setTimeArray] = useState<ZarrArray>();
    const [timeIndexArray, setTimeIndexArray] = useState<ZarrArray>();
    const [trackArray, setTrackArray] = useState<ZarrArray>();
    const [trackIndexArray, setTrackIndexArray] = useState<ZarrArray>();
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
    const viewedIds = useRef<Array<number>>([]);

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

    // update the time index array when the dataUrl changes
    useEffect(() => {
        console.log("load data from %s", dataUrl);
        const timeIndexArray = loadArray(dataUrl.toString(), "vertices_grouped_by_time_indices");
        timeIndexArray.then((array: ZarrArray) => {
            setTimeIndexArray(array);
            setNumTimes(array.shape[0]);
        });
    }, [dataUrl]);

    // update the time array when the time index array changes
    useEffect(() => {
        console.log("load data from %s", dataUrl);
        loadArray(dataUrl.toString(), "vertices_grouped_by_id").then(setTrackArray);
        loadArray(dataUrl.toString(), "vertices_grouped_by_id_indices").then(setTrackIndexArray);
        const timeArray = loadArray(dataUrl.toString(), "vertices_grouped_by_time");
        // TODO: add clean-up by returning another closure
        timeArray.then((array: ZarrArray) => {
            setTimeArray(array);
            setCurTime(0);
        });
    }, [timeIndexArray]);

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
        if (!timeIndexArray) return;
        // TODO: how to get the max number of points?
        canvas.current?.initPointsGeometry(30000);
        canvas.current?.initTracksGeometry(0, timeIndexArray.shape[0]);
    }, [timeArray]);

    // update the points when the array or timepoint changes
    useEffect(() => {
        setSelectedPoints({});
        let ignore = false;
        // TODO: this is a very basic attempt to prevent stale data
        // in addition, we should debounce the input and verify the data is current
        // before rendering it
        if (timeArray && !ignore) {
            console.debug("fetch points at time %d", curTime);
            fetchPointsAtTime(timeArray, timeIndexArray, curTime).then((data) => {
                console.debug("got %d points for time %d", data.length, curTime);
                if (ignore) {
                    console.debug("IGNORE SET points at time %d", curTime);
                    return;
                }
                viewedIds.current = [];
                for (let i = 0; i < data.length; ++i) {
                    viewedIds.current.push(data[i][0]);
                }
                canvas.current?.setPointsPositions(data);
            });
        } else {
            console.debug("IGNORE FETCH points at time %d", curTime);
        }
        return () => {
            ignore = true;
        };
    }, [timeArray, curTime]);

    useEffect(() => {
        const selected = getSelectedIds(selectedPoints, viewedIds.current);
        console.log("selected changed: %s", selected);
        if (selected && selected.length > 0) {
            canvas.current?.initTracksGeometry(selected.length, timeIndexArray.shape[0]);
            for (let i = 0; i < selected.length; ++i) {
                // TODO: the track indices might be the ID - 1, but this is a
                // guess based on a few data.
                const s = selected[i] - 1;
                fetchPointsForTrack(trackArray, trackIndexArray, s).then((data) => {
                    console.debug("got %s points for track %d", data.length, s);
                    canvas.current?.setTracksPositions(i, data);
                });
            }
        }
    }, [selectedPoints]);

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
                    intent={timeArray ? "default" : "error"}
                />
                <InputSlider
                    id="time-frame-slider"
                    aria-labelledby="input-slider-time-frame"
                    disabled={timeArray === undefined}
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
                        disabled={timeArray === undefined}
                        onChange={(e) => {
                            setAutoRotate((e.target as HTMLInputElement).checked);
                        }}
                    />
                    <InputToggle
                        onLabel="Play"
                        offLabel="Play"
                        disabled={timeArray === undefined}
                        onChange={(e) => {
                            setPlaying((e.target as HTMLInputElement).checked);
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

function getSelectedIds(collection: PointsCollection | undefined, viewedIds: Array<number>) {
    let selectedIds = [];
    if (collection) {
        console.debug("viewed IDs:", viewedIds);
        const selections = Object.values(collection);
        if (selections.length > 0 && viewedIds.length > 0) {
            selectedIds = selections[0].map((index: number) => viewedIds[index]);
        }
        console.debug("selected IDs:", selectedIds);
    }
    return selectedIds;
}

async function loadArray(store: string, path: string) {
    let array;
    try {
        array = await openArray({
            store: store,
            path: path,
            mode: "r",
        });
    } catch (err) {
        console.error("Error opening array: %s", err);
        array = undefined;
    }
    console.log("loaded new array: %s", array.shape);
    return array;
}

async function fetchPointsAtTime(
    timeArray: ZarrArray,
    timeIndexArray: ZarrArray,
    timeIndex: number,
): Promise<Array<Float32Array>> {
    console.debug("fetchPointsAtTime: %d", timeIndex);
    const startIndex = await timeIndexArray.get([timeIndex]);
    let endIndex = timeArray.shape[0];
    if (timeIndex + 1 < timeArray.shape[0]) {
        endIndex = await timeIndexArray.get([timeIndex + 1]);
    }
    console.debug("fetching vertices from time row %d to %d", startIndex, endIndex);
    const points: Array<Float32Array> = (await timeArray.get([slice(startIndex, endIndex), slice(0, 4)])).data;
    return points;
}

async function fetchPointsForTrack(
    trackArray: ZarrArray,
    trackIndexArray: ZarrArray,
    trackIndex: number,
): Promise<Array<Float32Array>> {
    console.debug("fetchPointsForTrack: %s", trackIndex);
    let endIndex = trackArray.shape[0];
    let startIndex;
    if (trackIndex + 1 < trackArray.shape[0]) {
        const startEnd = (await trackIndexArray.get([slice(trackIndex, trackIndex + 2)])).data;
        startIndex = startEnd[0];
        endIndex = startEnd[1];
    } else {
        startIndex = await trackIndexArray.get([trackIndex]);
    }
    console.debug("fetching vertices from track row %d to %d", startIndex, endIndex);
    const rows = await trackArray.get([slice(startIndex, endIndex), slice(0, 5)]);
    const points = rows.get([null, slice(0, 3)]).data;
    const parentId = rows.get([0, 4]);
    console.debug("found parentId %d", parentId);
    if (parentId > 0) {
        const parentPoints = await fetchPointsForTrack(trackArray, trackIndexArray, parentId - 1);
        points.unshift(...parentPoints);
    }
    // TODO: push descendants in order
    return points;
}
