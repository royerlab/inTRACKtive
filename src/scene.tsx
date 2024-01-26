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

class Canvas {
    width: number
    height: number
    renderer: THREE.WebGLRenderer
    points: THREE.Points
    composer: EffectComposer
    controls: OrbitControls
    bloomPass: UnrealBloomPass
    selectionBox: PointSelectionBox
    selectionHelper: SelectionHelper

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        const aspect = width / height;
    
        const scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer();

        const camera = new THREE.PerspectiveCamera(
            35,             // FOV
            aspect,         // Aspect
            0.1,            // Near
            10000           // Far
        );

        // Default position from interacting with ZSNS001
        // TODO: this should be set/reset when the data changes
        const target = new THREE.Vector3(500, 500, 250);
        camera.position.set(target.x, target.y, target.z - 1500);
        camera.lookAt(target.x, target.y, target.z);

        const geometry = new THREE.BufferGeometry();
        const material = new THREE.PointsMaterial({ size: 5.0, vertexColors: true });
        this.points = new THREE.Points(geometry, material);

        scene.add(new THREE.AxesHelper(128));
        scene.add(this.points);

        // Effect composition.
        const renderModel = new RenderPass(scene, camera);
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(width, height), // resolution
            0.5, // strength
            0, // radius
            0  // threshold
        );
        const outputPass = new OutputPass();
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderModel);
        this.composer.addPass(this.bloomPass);
        this.composer.addPass(outputPass);

        // Point selection
        this.selectionHelper = new SelectionHelper(this.renderer, 'selectBox');
        this.selectionHelper.enabled = false;
        this.selectionBox = new PointSelectionBox(camera, scene);
        // TODO: improve the behavior when pressing/releasing the mouse and
        // shift key in different orders
        const pointerUp = this.pointerUp.bind(this);
        this.renderer.domElement.addEventListener('pointerup', pointerUp);

        // TODO: add clean-up by returning another closure
        // Set up controls
        this.controls = new OrbitControls(camera, this.renderer.domElement);
        this.controls.target.set(target.x, target.y, target.z);
        this.controls.autoRotateSpeed = 1;
    }

    animate() {
        const animate = this.animate.bind(this);
        requestAnimationFrame(animate);
        // Render the scene
        this.composer.render();
        this.controls.update();
    }

    setSize(width: number, height: number) {
        this.bloomPass.resolution.set(width, height);
        this.renderer.setSize(width, height);
        this.composer.setSize(width, height);
    }

    setSelecting(selecting: boolean) {
        this.selectionHelper.enabled = selecting;
        this.controls.enabled = !selecting;
    }

    pointerUp() {
        console.log("pointerUp: %s", this.selectionHelper.enabled);
        if (this.selectionHelper && this.selectionHelper.enabled) {
            // Mouse to normalized render/canvas coords from:
            // https://codepen.io/boytchev/pen/NWOMrxW?editors=0011
            const canvas = this.renderer.domElement.getBoundingClientRect();

            const topLeft = this.selectionHelper.pointTopLeft;
            const left = (topLeft.x - canvas.left) / canvas.width * 2 - 1;
            const top = - (topLeft.y - canvas.top) / canvas.height * 2 + 1;

            const bottomRight = this.selectionHelper.pointBottomRight;
            const right = (bottomRight.x - canvas.left) / canvas.width * 2 - 1;
            const bottom = - (bottomRight.y - canvas.top) / canvas.height * 2 + 1;
            console.debug(
                'selectionHelper, top = %f, left = %f, bottom = %f, right = %f',
                top, left, bottom, right,
            );

            // TODO: check the z-value of these points
            this.selectionBox.startPoint.set(left, top, 0.5);
            this.selectionBox.endPoint.set(right, bottom, 0.5);

            // TODO: consider restricting selection to a specific object
            const selection = this.selectionBox.select();
            console.debug("selected points:", selection);

            if (this.points && this.points.id in selection) {
                const geometry = this.points.geometry as THREE.BufferGeometry;
                const colors = geometry.getAttribute('color') as THREE.BufferAttribute;
                const color = new THREE.Color(0xffffff);
                for (const i of selection[this.points.id]) {
                    colors.setXYZ(i, color.r, color.g, color.b);
                }
                colors.needsUpdate = true;
            }
        }
    }

    dispose() {
        this.renderer.domElement.removeEventListener('pointerup', this.pointerUp);
        this.renderer.dispose();
        this.points.geometry.dispose();
        if (Array.isArray(this.points.material)) {
            for (const material of this.points.material) {
                material.dispose();
            }
        } else {
            this.points.material.dispose();
        }
        this.selectionHelper.dispose();
    }
 
}

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
        const renderer = canvas.current.renderer;
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
            fetchPointsAtTime(array, curTime, canvas.current!.points);
        } else {
            console.log('IGNORE fetch points at time %d', curTime);
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
        const subArray = await array.get([timeIndex, slice(start, end)]);
        const coords = subArray.data;

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
