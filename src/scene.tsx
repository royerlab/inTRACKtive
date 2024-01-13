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
                    // style={{ color: array.current ? "black" : "red" }}
                />
            </div>
        </div>
    );
}
//         // postprocessing
//         const renderModel = new RenderPass(this.scene, this.camera);
//         const bloomPass = new UnrealBloomPass(
//             new THREE.Vector2(renderWidth, renderHeight), // resolution
//             0.5, // strength
//             0, // radius
//             0  // threshold
//         );
//         const outputPass = new OutputPass();
//         this.composer = new EffectComposer(this.renderer);
//         this.composer.addPass(renderModel);
//         this.composer.addPass(bloomPass);
//         this.composer.addPass(outputPass);
// 
// 
//         // From https://github.com/mrdoob/three.js/blob/master/examples/misc_boxselection.html
//         this.selectionHelper = new SelectionHelper(this.renderer, 'selectBox');
//         this.selectionBox = new PointSelectionBox(this.camera, this.scene);
//         const handlePointerUp = this.handlePointerUp.bind(this);
//         const handleKeyDown = this.handleKeyDown.bind(this);
//         const handleKeyUp = this.handleKeyUp.bind(this);
//         document.addEventListener('pointerup', handlePointerUp);
//         document.addEventListener('keydown', handleKeyDown);
//         document.addEventListener('keyup', handleKeyUp);
// 
//         const url = new URL(DEFAULT_ZARR_URL);
//         const pathParts = url.pathname.split('/');
//         this.path = pathParts.pop() || "";
//         this.store = url.origin + pathParts.join('/');
//     }
// 
//     handlePointerUp() {
//         if (this.selectionHelper.enabled) {
//             // Mouse to normalized render/canvas coords from:
//             // https://codepen.io/boytchev/pen/NWOMrxW?editors=0011
//             const canvas = this.renderer.domElement.getBoundingClientRect();
// 
//             const topLeft = this.selectionHelper.pointTopLeft;
//             const left = (topLeft.x - canvas.left) / canvas.width * 2 - 1;
//             const top = - (topLeft.y - canvas.top) / canvas.height * 2 + 1;
// 
//             const bottomRight = this.selectionHelper.pointBottomRight;
//             const right = (bottomRight.x - canvas.left) / canvas.width * 2 - 1;
//             const bottom = - (bottomRight.y - canvas.top) / canvas.height * 2 + 1;
//             console.debug(
//                 'selectionHelper, top = %f, left = %f, bottom = %f, right = %f',
//                 top, left, bottom, right,
//             );
// 
//             // TODO: check the z-value of these points
//             this.selectionBox.startPoint.set(left, top, 0.5);
//             this.selectionBox.endPoint.set(right, bottom, 0.5);
// 
//             // TODO: consider restricting selection to a specific object
//             const selection = this.selectionBox.select();
//             console.debug("selected points:", selection);
// 
//             if (this.points.id in selection) {
//                 const geometry = this.points.geometry as THREE.BufferGeometry;
//                 const colors = geometry.getAttribute('color') as THREE.BufferAttribute;
//                 const color = new THREE.Color(0xffffff);
//                 for (const i of selection[this.points.id]) {
//                     colors.setXYZ(i, color.r, color.g, color.b);
//                 }
//                 colors.needsUpdate = true;
//                 this.rerender();
//             }
//         }
//     }
// 
//     handleKeyUp(event: KeyboardEvent) {
//         console.debug('handleKeyUp: %s', event.key);
//         if (event.key === "Shift") {
//             this.setControlCamera(true);
//         }
//     }
// 
//     handleKeyDown(event: KeyboardEvent) {
//         console.debug('handleKeyDown: %s', event.key);
//         if (event.key === "Shift") {
//             this.setControlCamera(false);
//         }
//     }
// 
//     handleTimeChange(event: ChangeEvent) {
//         console.log('handleTimeChange: %s', event);
//         const slider = event.target as HTMLInputElement;
//         const timeIndex = Math.floor(Number(slider.value));
//         this.fetchPointsAtTime(timeIndex);
//     }
// 
//     handleURLChange(event: ChangeEvent) {
//         console.log('handleURLChange: %s', event);
//         const input = event.target as HTMLInputElement;
//         const url = input.value;
//         this.setStoreAndPath(new URL(url));
//         const timeSlider = document.getElementById("timeSlider") as HTMLInputElement;
//         const t = Math.floor(Number(timeSlider.value));
//         this.fetchPointsAtTime(t);
//     }
// 
//     nearToFar(near: THREE.Vector3, cameraPos: THREE.Vector3) {
//         const far = new THREE.Vector3();
//         far.copy(near);
//         far.sub(cameraPos);
//         far.normalize();
//         far.multiplyScalar(Number.MAX_VALUE)
//         far.add(cameraPos);
//         return far;
//     }
// 
//     handleControlClick() {
//         console.log('handleControlClick');
//         this.setControlCamera(!this.controls.enabled)
//     }
// 
//     handlePlayClick() {
//         console.log('handlePlayClick');
//         this.setAutoRotate(!this.state.autoRotate);
//         this.animate();
//     }
// 
//     setControlCamera(value: boolean) {
//         this.controls.enabled = value;
//         this.selectionHelper.enabled = !value;
//         this.setState({ controlCamera: value });
//     }
// 
//     setAutoRotate(value: boolean) {
//         this.controls.autoRotate = value;
//         this.setState({ autoRotate: value });
//     }
// 
//     setStoreAndPath(url: URL) {
//         const pathParts = url.pathname.split('/');
//         const newPath = pathParts.pop() || "";
//         const newStore = url.origin + pathParts.join('/');
//         if (newStore !== this.store || newPath !== this.path) {
//             this.store = newStore;
//             this.path = newPath;
//             this.array = undefined;
//         }
//     }
// 
//     render() {
//         console.debug("Scene.render", this.props);
//         if (this.props.renderWidth && this.props.renderHeight) {
//             this.renderer.setSize(this.props.renderWidth, this.props.renderHeight);
//             this.composer.setSize(this.props.renderWidth, this.props.renderHeight);
//             this.rerender();
//         }
//         let handleTimeChange = this.handleTimeChange.bind(this);
//         let handleURLChange = this.handleURLChange.bind(this);
//         let handlePlayClick = this.handlePlayClick.bind(this);
//         let handleControlClick = this.handleControlClick.bind(this);
//         let url = this.store + '/' + this.path;
//         const playLabel = this.state.autoRotate ? "Stop" : "Spin";
//         const controlLabel = this.state.controlCamera ? "Camera" : "Select";
//         return (
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
//         );
//     }
// 
//     rerender() {
//         this.composer.render();
//     }
// 
//     animate() {
//         if (this.controls.autoRotate) {
//             const animate = this.animate.bind(this);
//             requestAnimationFrame(animate);
//             this.controls.update();
//             this.rerender();
//         }
//     }
// 
//     componentDidMount() {
//         this.scene.add(this.points);
// 
//         this.rerender();
// 
//         this.node?.appendChild(this.renderer.domElement);
//         // setTimeout(() => {
//         //     this.base?.appendChild(this.renderer.domElement);
//         // }, 1);
// 
//         this.fetchPointsAtTime(0);
// 
//         this.setControlCamera(true);
//     }
// 


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
