import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
// import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
// import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
// import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
// import { SelectionHelper } from 'three/addons/interactive/SelectionHelper.js';
// import { PointSelectionBox } from './PointSelectionBox';

// @ts-expect-error
import { ZarrArray, slice, openArray } from "zarr";


const DEFAULT_ZARR_URL = new URL("https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/tracks_benchmark/ZSNS001_nodes.zarr");

interface SceneProps {
    renderWidth?: number;
    renderHeight?: number;
}

export default function Scene(props: SceneProps) {

    // TODO: make this a state variable?
    const [array, setArray] = useState<ZarrArray>();
    const [dataUrl, setDataUrl] = useState(DEFAULT_ZARR_URL);
    const [numTimes, setNumTimes] = useState(0);
    const [curTime, setCurTime] = useState(0);
    // const [autoRotate, setAutoRotate] = useState(false);

    const renderWidth = props.renderWidth || 800;
    const renderHeight = props.renderHeight || 600;

    // Use references here for two things:
    // * to manage objects that should never change, even when the component re-renders
    // * to avoid triggering re-renders when these change
    const divRef: React.RefObject<HTMLDivElement> = useRef(null);
    const renderer = useRef<THREE.WebGLRenderer>();
    const scene = useRef<THREE.Scene>();
    const points = useRef<THREE.Points>();
    const camera = useRef<THREE.PerspectiveCamera>();
    const controls = useRef<OrbitControls>();
    const aspect = useRef(renderWidth / renderHeight);

    // this useEffect is intended to make this part run only on mount
    // this requires keeping the dependency array empty
    useEffect(() => {
        // Initialize renderer
        renderer.current = new THREE.WebGLRenderer();
        divRef.current?.appendChild(renderer.current.domElement);
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
        // TODO: this should be reset when the data changes
        const target = new THREE.Vector3(500, 500, 250);
        camera.current.position.set(target.x, target.y, target.z - 1500);
        camera.current.lookAt(target.x, target.y, target.z);

        // TODO: add clean-up by returning another closure
        // Set up controls
        controls.current = new OrbitControls(camera.current, renderer.current.domElement);
        controls.current.target.set(target.x, target.y, target.z);
        controls.current.autoRotateSpeed = 4;

        // Animation function
        const animate = () => {
            requestAnimationFrame(animate);

            // Render the scene
            if (scene.current && camera.current) {
                renderer.current?.render(scene.current, camera.current);
            }
            controls.current?.update();
        };
        // start animating - this keeps the scene rendering when controls change, etc.
        animate()

        // TODO: add clean-up by returning another closure
    }, []); // dependency array must be empty to run only on mount!

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

    // update the points when the array or timepoint changes
    useEffect(() => {
        if (array) {
            fetchPointsAtTime(array, curTime, points.current!);
        }
        // TODO: add clean-up by returning another closure
    }, [array, numTimes, curTime]);

    renderer.current?.setSize(renderWidth, renderHeight);

    return (
        <div ref={divRef}>
            <div className="inputcontainer">
                <input
                    type="text" className="textinput" id="zarrURL"
                    value={dataUrl.toString()}
                    onChange={(event) => setDataUrl(() => new URL(event.target.value))}
                    style={{ color: array ? "black" : "red" }}
                />
            </div>
        </div>
    );
}
//             <div ref={node => this.node = node}>
//                 <div className="inputcontainer">
//                     <input
//                         type="text" className="textinput" id="zarrURL"
//                         value={url}
//                         onChange={handleURLChange}
//                         style={{ color: this.array ? "black" : "red" }}
//                     />
//                     <button id="controlButton" onClick={handleControlClick}>{controlLabel}</button>
//                     <button id="playButton" onClick={handlePlayClick}>{playLabel}</button>
//                     <input
//                         type="range" min="0" max={this.state.numTimes - 1}
//                         disabled={this.array === undefined}
//                         value={this.state.curTime}
//                         className="slider" id="timeSlider" onChange={handleTimeChange}
//                     />
//                     <label htmlFor="timeSlider">{this.state.curTime} / {this.state.numTimes}</label>
//                 </div>
//             </div>


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
    console.log('fetchPointsAtTime: %d', timeIndex);
    const maxPoints = array.shape[1] / 3;
    // TODO: somewhat arbitrary right. Should calculate some number that would
    // be reasonable for slow connections or use the chunk size.
    const trackChunkSize = 100_000;

    // Initialize the geometry attributes.
    const geometry = points.geometry;
    const positions = new Float32Array(3 * maxPoints);
    const colors = new Float32Array(3 * maxPoints);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setDrawRange(0, 0)

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
        const points = await array.get([timeIndex, slice(start, end)]);
        const coords = points.data;

        for (let j = 0; j < coords.length; j += 3) {
            // TODO: this seems to work for the int8 data, but not sure it's correct
            if (coords[j] > -128) {
                positionAttribute.setXYZ(pointIndex, coords[j], coords[j + 1], coords[j + 2]);
                pointIndex++;
            }
        }
        positionAttribute.needsUpdate = true;

        geometry.setDrawRange(0, pointIndex)
        geometry.computeBoundingSphere();

        console.log("added points up to %d as %d", i + trackChunkSize, pointIndex);
    }
}
