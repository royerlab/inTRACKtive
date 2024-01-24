import { useEffect, useRef, useState } from 'react';
import { InputSlider, InputText, InputToggle } from "@czi-sds/components";
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SelectionHelper } from 'three/addons/interactive/SelectionHelper.js';
import { PointSelectionBox } from './PointSelectionBox';

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
    const renderer = useRef<THREE.WebGLRenderer>();
    const composer = useRef<EffectComposer>();
    const bloomPass = useRef<UnrealBloomPass>();
    const scene = useRef<THREE.Scene>();
    const camera = useRef<THREE.PerspectiveCamera>();
    const points = useRef<THREE.Points>();
    const controls = useRef<OrbitControls>();
    const selectionHelper = useRef<SelectionHelper>();
    const selectionBox = useRef<PointSelectionBox>();
    const aspect = useRef(renderWidth / renderHeight);

    // this useEffect is intended to make this part run only on mount
    // this requires keeping the dependency array empty
    useEffect(() => {
        // Initialize renderer
        const rendererCurrent = new THREE.WebGLRenderer();
        renderer.current = rendererCurrent;

        // append renderer canvas
        const divCurrent = divRef.current;
        divCurrent?.appendChild(rendererCurrent.domElement);

        scene.current = new THREE.Scene();
        camera.current = new THREE.PerspectiveCamera(
            35,              // FOV
            aspect.current,  // Aspect
            0.1,             // Near
            10000            // Far
        );

        const geometry = new THREE.BufferGeometry();
        const material = new THREE.PointsMaterial({ size: 5.0, vertexColors: true });
        points.current = new THREE.Points(geometry, material);

        scene.current.add(new THREE.AxesHelper(128));
        scene.current.add(points.current);

        // Default position from interacting with ZSNS001
        // TODO: this should be set/reset when the data changes
        const target = new THREE.Vector3(500, 500, 250);
        camera.current.position.set(target.x, target.y, target.z - 1500);
        camera.current.lookAt(target.x, target.y, target.z);

        const renderModel = new RenderPass(scene.current, camera.current);
        bloomPass.current = new UnrealBloomPass(
            new THREE.Vector2(renderWidth, renderHeight), // resolution
            0.5, // strength
            0, // radius
            0  // threshold
        );
        const outputPass = new OutputPass();
        composer.current = new EffectComposer(rendererCurrent);
        composer.current.addPass(renderModel);
        composer.current.addPass(bloomPass.current);
        composer.current.addPass(outputPass);

        selectionHelper.current = new SelectionHelper(rendererCurrent, 'selectBox');
        selectionHelper.current.enabled = false;
        const keyDown = (event: KeyboardEvent) => {
            if (event.repeat) { return; } // ignore repeats (key held down)
            if (event.key === 'Shift') {
                setSelecting(true);
            }
        };
        const keyUp = (event: KeyboardEvent) => {
            if (event.key === 'Shift') {
                setSelecting(false);
            }
        };
        // key listeners are added to the document because we don't want the
        // canvase to have to be selected prior to listening for them
        document.addEventListener('keydown', keyDown);
        document.addEventListener('keyup', keyUp);
        selectionBox.current = new PointSelectionBox(camera.current, scene.current);

        // TODO: move this out of the component and improve the behavior when
        // pressing/releasing the mouse and shift key in different orders
        // note: this is a problem in the production version as well
        const pointerUp = () => {
            if (
                selectionBox.current
                && selectionHelper.current
                && selectionHelper.current.enabled
            ) {
                // Mouse to normalized render/canvas coords from:
                // https://codepen.io/boytchev/pen/NWOMrxW?editors=0011
                const canvas = rendererCurrent.domElement.getBoundingClientRect();

                const topLeft = selectionHelper.current.pointTopLeft;
                const left = (topLeft.x - canvas.left) / canvas.width * 2 - 1;
                const top = - (topLeft.y - canvas.top) / canvas.height * 2 + 1;

                const bottomRight = selectionHelper.current.pointBottomRight;
                const right = (bottomRight.x - canvas.left) / canvas.width * 2 - 1;
                const bottom = - (bottomRight.y - canvas.top) / canvas.height * 2 + 1;
                console.debug(
                    'selectionHelper, top = %f, left = %f, bottom = %f, right = %f',
                    top, left, bottom, right,
                );

                // TODO: check the z-value of these points
                selectionBox.current.startPoint.set(left, top, 0.5);
                selectionBox.current.endPoint.set(right, bottom, 0.5);

                // TODO: consider restricting selection to a specific object
                const selection = selectionBox.current.select();
                console.debug("selected points:", selection);

                if (points.current && points.current.id in selection) {
                    const geometry = points.current.geometry as THREE.BufferGeometry;
                    const colors = geometry.getAttribute('color') as THREE.BufferAttribute;
                    const color = new THREE.Color(0xffffff);
                    for (const i of selection[points.current.id]) {
                        colors.setXYZ(i, color.r, color.g, color.b);
                    }
                    colors.needsUpdate = true;
                }
            }
        }
        rendererCurrent.domElement.addEventListener('pointerup', pointerUp);

        // TODO: add clean-up by returning another closure
        // Set up controls
        controls.current = new OrbitControls(camera.current, rendererCurrent.domElement);
        controls.current.target.set(target.x, target.y, target.z);
        controls.current.autoRotateSpeed = 1;

        // Animation function
        const animate = () => {
            requestAnimationFrame(animate);

            // Render the scene
            composer.current?.render();
            controls.current?.update();
        };
        // start animating - this keeps the scene rendering when controls change, etc.
        animate()

        return () => {
            rendererCurrent.domElement.removeEventListener('pointerup', pointerUp);
            rendererCurrent.domElement.remove();
            rendererCurrent.dispose();
            points.current?.geometry.dispose();
            if (Array.isArray(points.current?.material)) {
                for (const material of points.current?.material) {
                    material.dispose();
                }
            } else {
                points.current?.material.dispose();
            }
            selectionHelper.current?.dispose();
            document.removeEventListener('keydown', keyDown);
            document.removeEventListener('keyup', keyUp);
        }
    }, []); // dependency array must be empty to run only on mount!

    if (selectionHelper.current && controls.current) {
        selectionHelper.current.enabled = selecting;
        controls.current.enabled = !selecting;
    }

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
        controls.current && (controls.current.autoRotate = autoRotate);
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

    // update the points when the array or timepoint changes
    useEffect(() => {
        let ignore = false;
        // TODO: this is a very basic attempt to prevent stale data, and I don't
        // know it actually works given how the fetching and rendering are done
        // together in `fetchPointsAtTime`
        // instead, perhaps debounce the input and verify the data is current
        // before rendering it
        if (array && !ignore) {
            console.log('fetch points at time %d', curTime);
            fetchPointsAtTime(array, curTime, points.current!);
        } else {
            console.log('IGNORE fetch points at time %d', curTime);
        }
        return () => {
            ignore = true;
        }
    }, [array, curTime]);

    // update the renderer and composer when the render size changes
    // TODO: check performance and avoid if unchanged
    bloomPass.current?.resolution.set(renderWidth, renderHeight);
    renderer.current?.setSize(renderWidth, renderHeight);
    composer.current?.setSize(renderWidth, renderHeight);

    // set up marks for the time slider
    const spacing = 100;
    const marks = [...Array(Math.round(numTimes / spacing)).keys()].map((i) => ({ value: i * spacing, label: i * spacing }));
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
    console.log('array: %s', array);
    return array;
}


async function fetchPointsAtTime(array: ZarrArray, timeIndex: number, points: THREE.Points) {
    // TODO: split this function - it fetches points *and* renders them
    console.log('fetchPointsAtTime: %d', timeIndex);
    const maxPoints = array.shape[1] / 3;
    // TODO: somewhat arbitrary right. Should calculate some number that would
    // be reasonable for slow connections or use the chunk size.
    const trackChunkSize = 100_000;

    // Initialize the geometry attributes.
    const geometry = points.geometry;
    if (
        !geometry.getAttribute('position')
        || geometry.getAttribute('position').count !== maxPoints
    ) {
        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(new Float32Array(3 * maxPoints), 3),
        );
        // prevent drawing uninitialized points at the origin
        geometry.setDrawRange(0, 0)
    }
    if (
        !geometry.getAttribute('color')
        || geometry.getAttribute('color').count !== maxPoints
    ) {
        geometry.setAttribute(
            'color',
            new THREE.Float32BufferAttribute(new Float32Array(3 * maxPoints), 3),
        );
    }
    // don't reset draw range here, it causes flickering

    // Initialize all the colors immediately.
    const color = new THREE.Color();
    const colorAttribute = geometry.getAttribute('color');
    for (let i = 0; i < maxPoints; i++) {
        const r = Math.random();
        const g = Math.random();
        const b = Math.random();
        color.setRGB(r, g, b, THREE.SRGBColorSpace);
        colorAttribute.setXYZ(i, color.r, color.g, color.b);
    }
    colorAttribute.needsUpdate = true;

    // Load the positions progressively.
    const positionAttribute = geometry.getAttribute('position');
    for (let i = 0, pointIndex = 0; i < maxPoints; i += trackChunkSize) {
        const start = 3 * i;
        const end = Math.min(array.shape[1], 3 * (i + trackChunkSize));
        // TODO: try/catch here as some requests will fail
        const points = await array.get([timeIndex, slice(start, end)]);
        const coords = points.data;

        for (let j = 0; j < coords.length; j += 3) {
            // TODO: this seems to work for the int8 data, but not sure it's correct
            if (coords[j] > -128) {
                positionAttribute.setXYZ(pointIndex, coords[j], coords[j + 1], coords[j + 2]);
                pointIndex++;
            }
        }
        geometry.setDrawRange(0, pointIndex)
        positionAttribute.needsUpdate = true;
        geometry.computeBoundingSphere();

        console.log(
            "added points for timepoint %d, up to %d as %d",
            timeIndex,
            i + trackChunkSize,
            pointIndex
        );
    }
}
