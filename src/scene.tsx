import { useEffect, useRef, useState } from 'react';
import { InputSlider, InputText, InputToggle } from "@czi-sds/components";
import { Canvas } from './canvas';

// @ts-expect-error
import { ZarrArray, slice, openArray } from "zarr";


const DEFAULT_ZARR_URL = new URL("https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/tracks_benchmark/ZSNS001_nodes.zarr");


interface SceneProps {
    renderWidth: number;
    renderHeight?: number;
}

export default function Scene(props: SceneProps) {

    const renderWidth = props.renderWidth || 800;
    const renderHeight = props.renderHeight || 600;

    const [array, setArray] = useState<ZarrArray>();
    const [dataUrl, setDataUrl] = useState(DEFAULT_ZARR_URL);
    const [numTimes, setNumTimes] = useState(0);
    const [curTime, setCurTime] = useState(0);
    const [autoRotate, setAutoRotate] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [selecting, setSelecting] = useState(false);

    // Use references here for two things:
    // * manage objects that should never change, even when the component re-renders
    // * avoid triggering re-renders when these *do* change
    const divRef: React.RefObject<HTMLDivElement> = useRef(null);
    const canvas = useRef<Canvas>();

    // this useEffect is intended to make this part run only on mount
    // this requires keeping the dependency array empty
    useEffect(() => {
        // initialize the canvas
        canvas.current = new Canvas(renderWidth, renderHeight);

        // append renderer canvas
        const divCurrent = divRef.current;
        const renderer = canvas.current!.renderer;
        divCurrent?.appendChild(renderer.domElement);

        const keyDown = (event: KeyboardEvent) => {
            console.log("keyDown: %s", event.key);
            if (event.repeat) { return; } // ignore repeats (key held down)
            if (event.key === 'Shift') {
                setSelecting(true);
            }
        };
        const keyUp = (event: KeyboardEvent) => {
            console.log("keyUp: %s", event.key);
            if (event.key === 'Shift') {
                setSelecting(false);
            }
        };

        // key listeners are added to the document because we don't want the
        // canvas to have to be selected prior to listening for them
        document.addEventListener('keydown', keyDown);
        document.addEventListener('keyup', keyUp);

        // start animating - this keeps the scene rendering when controls change, etc.
        canvas.current.animate();

        return () => {
            renderer.domElement.remove();
            canvas.current?.dispose();
            document.removeEventListener('keydown', keyDown);
            document.removeEventListener('keyup', keyUp);
        }
    }, []); // dependency array must be empty to run only on mount!

    canvas.current?.setSelecting(selecting);

    // update the array when the dataUrl changes
    useEffect(() => {
        console.log('load data from %s', dataUrl);
        const pathParts = dataUrl.pathname.split('/');
        const path = pathParts.pop() || "";
        const store = dataUrl.origin + pathParts.join('/');
        const array = loadArray(store, path);
        // TODO: add clean-up by returning another closure
        array.then((array: ZarrArray) => {
            setArray(array);
            setNumTimes(array.shape[0]);
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
            const frameDelay = 1000 / 8;  // 1000 / fps
            const interval = setInterval(() => {
                setCurTime((curTime + 1) % numTimes);
            }, frameDelay);
            return () => {
                clearInterval(interval)
            };
        }
    }, [numTimes, curTime, playing]);

    // update the geometry buffers when the array changes
    useEffect(() => {
        if (!array) return;
        canvas.current?.initPointsGeometry(array.shape[1] / 3);
    }, [array]);

    // update the points when the array or timepoint changes
    useEffect(() => {
        let ignore = false;
        // TODO: this is a very basic attempt to prevent stale data
        // in addition, we should debounce the input and verify the data is current
        // before rendering it
        if (array && !ignore) {
            console.debug('fetch points at time %d', curTime);
            fetchPointsAtTime(array, curTime).then(data => {
                console.debug('got %d points for time %d', data.length / 3, curTime);
                if (ignore) {
                    console.debug('IGNORE SET points at time %d', curTime);
                    return;
                }
                canvas.current?.setPointsPositions(data);
            });
        } else {
            console.debug('IGNORE FETCH points at time %d', curTime);
        }
        return () => {
            ignore = true;
        }
    }, [array, curTime]);

    // update the renderer and composer when the render size changes
    // TODO: check performance and avoid if unchanged
    canvas.current?.setSize(renderWidth, renderHeight);

    // set up marks for the time slider
    const spacing = 100;
    const marks = [...Array(Math.round(numTimes / spacing)).keys()].map(
        (i) => ({ value: i * spacing, label: i * spacing })
    );
    marks.push({ value: numTimes - 1, label: numTimes - 1 });

    return (
        <div ref={divRef}>
            <div className="inputcontainer">
                <InputText
                    id='url-input'
                    label='Zarr URL'
                    placeholder={DEFAULT_ZARR_URL.toString()}
                    value={dataUrl.toString()}
                    onChange={e => setDataUrl(new URL(e.target.value))}
                    fullWidth={true}
                    intent={array ? "default" : "error"}
                />
                <InputSlider
                    id="time-frame-slider"
                    aria-labelledby="input-slider-time-frame"
                    disabled={array === undefined}
                    min={0}
                    max={numTimes - 1}
                    valueLabelDisplay='on'
                    onChange={(_, value) => setCurTime(value as number)}
                    marks={marks}
                    value={curTime}
                />
                <div className="buttoncontainer">
                    <InputToggle
                        onLabel="Spin"
                        offLabel="Spin"
                        disabled={array === undefined}
                        onChange={(e) => {
                            setAutoRotate((e.target as HTMLInputElement).checked)
                        }}
                    />
                    <InputToggle
                        onLabel="Play"
                        offLabel="Play"
                        disabled={array === undefined}
                        onChange={(e) => {
                            setPlaying((e.target as HTMLInputElement).checked)
                        }}
                    />
                </div>
            </div>
        </div>
    );
}


async function loadArray(store: string, path: string) {
    let array;
    try {
        array = await openArray({
            store: store,
            path: path,
            mode: "r"
        });
    } catch (err) {
        console.error("Error opening array: %s", err);
        array = undefined;
    }
    console.log('loaded new array: %s', array);
    return array;
}


async function fetchPointsAtTime(array: ZarrArray, timeIndex: number): Promise<Float32Array>{
    console.debug('fetchPointsAtTime: %d', timeIndex);
    const points: Float32Array = (await array.get([timeIndex, slice(null)])).data;
    // assume points < -127 are invalid, and all are at the end of the array
    // this is how the jagged array is stored in the zarr
    // for Float32 it's actually -9999, but the int8 data is -127
    let endIndex = points.findIndex(value => value <= -127);
    if (endIndex % 3 !== 0) {
        console.error('invalid points - not divisible by 3');
        endIndex -= endIndex % 3;
    }
    return points.subarray(0, endIndex);
}
