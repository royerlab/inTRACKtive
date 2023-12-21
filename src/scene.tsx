import { Component } from 'preact';
import { ChangeEvent } from 'preact/compat';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SelectionBox } from 'three/addons/interactive/SelectionBox.js';
import { SelectionHelper } from 'three/addons/interactive/SelectionHelper.js';
// @ts-expect-error
import { ZarrArray, slice, openArray } from "zarr";

const DEFAULT_ZARR_URL = "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/tracks_benchmark/ZSNS001_nodes.zarr"

class Scene extends Component {

    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private controls: OrbitControls;
    private points: THREE.Points;
    private composer: EffectComposer;
    private array: ZarrArray;
    private store: string;
    private path: string;
    private selectionBox: SelectionBox;
    private selectionHelper: SelectionHelper;

    state = { numTimes: 0, curTime: 0 };

    constructor() {
        super();
        
        const renderWidth = 800;
        const renderHeight = 600;

        // bind so that "this" refers to the class instance
        const rerender = this.rerender.bind(this);

        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(renderWidth, renderHeight);

        this.scene = new THREE.Scene();

        // Default position from interacting with ZSNS001
        const target = new THREE.Vector3(500, 500, 250);
        this.camera = new THREE.PerspectiveCamera(
            35,         // FOV
            renderWidth / renderHeight,  // Aspect
            0.1,        // Near
            10000       // Far
        );
        this.camera.position.set(target.x, target.y, target.z - 1500);
        this.camera.lookAt(target.x, target.y, target.z);
        // this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        // this.controls.target.set(target.x, target.y, target.z);
        // this.controls.update();
        // // bind so that "this" refers to the class instance
        // this.controls.addEventListener('change', rerender);

        // postprocessing
        const renderModel = new RenderPass(this.scene, this.camera);
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(renderWidth, renderHeight), // resolution
            0.5, // strength
            0, // radius
            0  // threshold
        );
        const outputPass = new OutputPass();
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderModel);
        this.composer.addPass(bloomPass);
        this.composer.addPass(outputPass);

        const geometry = new THREE.BufferGeometry();
        const material = new THREE.PointsMaterial({ size: 5.0, vertexColors: true });
        this.points = new THREE.Points(geometry, material);

        // From https://github.com/mrdoob/three.js/blob/master/examples/misc_boxselection.html
        this.selectionBox = new SelectionBox( this.camera, this.scene );
        this.selectionHelper = new SelectionHelper( this.renderer, 'selectBox' );
        const handlePointerDown = this.handlePointerDown.bind(this);
        const handlePointerMove = this.handlePointerMove.bind(this);
        const handlePointerUp = this.handlePointerUp.bind(this);
        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);

        const url = new URL(DEFAULT_ZARR_URL);
        const pathParts = url.pathname.split('/');
        this.path = pathParts.pop() || "";
        this.store = url.origin + pathParts.join('/');
    }

    handleTimeChange(event: ChangeEvent) {
        console.log('handleTimeChange: %s', event);
        const slider = event.target as HTMLInputElement;
        const timeIndex = Math.floor(Number(slider.value));
        this.fetchPointsAtTime(timeIndex);
    }

    handleURLChange(event: ChangeEvent) {
        console.log('handleURLChange: %s', event);
        const input = event.target as HTMLInputElement;
        const url = input.value;
        this.setStoreAndPath(new URL(url));
        const timeSlider = document.getElementById("timeSlider") as HTMLInputElement;
        const t = Math.floor(Number(timeSlider.value));
        this.fetchPointsAtTime(t);
    }

    handlePointerDown(event: PointerEvent) {
        console.log('handlePointerDown: %d, %d', event.clientX, event.clientY);

        //for ( const item of this.selectionBox.collection ) {
        //    item.material.emissive.set( 0x000000 );
        //}

        this.selectionBox.startPoint.set(
            ( event.clientX / 800 ) * 2 - 1,
            - ( event.clientY / 600 ) * 2 + 1,
            0.5 );
    }

    handlePointerMove(event: PointerEvent) {
        if ( this.selectionHelper.isDown ) {
            //for ( let i = 0; i < this.selectionBox.collection.length; i ++ ) {
            //    this.selectionBox.collection[i].material.emissive.set( 0x000000 );
            //}

            console.log('handlePointerMove: %d, %d', event.clientX, event.clientY);
            this.selectionBox.endPoint.set(
                ( event.clientX / 800 ) * 2 - 1,
                - ( event.clientY / 600 ) * 2 + 1,
                0.5 );

            const allSelected = this.selectionBox.select();
            console.log('handlePointerMove: selected %d points', allSelected.length);
            //for ( let i = 0; i < allSelected.length; i ++ ) {
            //    allSelected[i].material.emissive.set( 0xffffff );
            //}
        }
    }

    handlePointerUp(event: PointerEvent) {
        console.log('handlePointerUp: %d, %d', event.clientX, event.clientY);

        this.selectionBox.endPoint.set(
            ( event.clientX / 800 ) * 2 - 1,
            - ( event.clientY / 600 ) * 2 + 1,
            0.5 );

        const allSelected = this.selectionBox.select();
        console.log('handlePointerUp: selected %d points', allSelected.length);
        //for ( let i = 0; i < allSelected.length; i ++ ) {
        //    allSelected[i].material.emissive.set( 0xffffff );
        //}
    }

    setStoreAndPath(url: URL) {
        const pathParts = url.pathname.split('/');
        const newPath = pathParts.pop() || "";
        const newStore = url.origin + pathParts.join('/');
        if (newStore !== this.store || newPath !== this.path) {
            this.store = newStore;
            this.path = newPath;
            this.array = undefined;
        }
    }

    render() {
        let handleTimeChange = this.handleTimeChange.bind(this);
        let handleURLChange = this.handleURLChange.bind(this);
        let url = this.store + '/' + this.path;
        return (
            <div class="inputcontainer">
                <input
                    type="text" class="textinput" id="zarrURL"
                    value={url}
                    onChange={handleURLChange}
                    style={{ color: this.array ? "black" : "red" }}
                />
                <input
                    type="range" min="0" max={this.state.numTimes - 1}
                    disabled={this.array === undefined}
                    value={this.state.curTime}
                    class="slider" id="timeSlider" onChange={handleTimeChange}
                />
                <label for="timeSlider">{this.state.numTimes}</label>
            </div>
        );
    }

    rerender() {
        this.composer.render();
    }

    componentDidMount() {
        this.scene.add(this.points);

        this.rerender();

        setTimeout(() => {
            this.base?.appendChild(this.renderer.domElement);
        }, 1);

        this.fetchPointsAtTime(0);
    }

    async loadArray() {
        console.log('loadArray');
        try {
            this.array = await openArray({
                store: this.store,
                path: this.path,
                mode: "r"
            });
        } catch (err) {
            console.error("Error opening array: %s", err);
            this.array = undefined;
        }
        const numTimes = this.array?.shape[0] ?? 0;
        this.setState({ numTimes: numTimes });
        return numTimes > 0;
    }

    async fetchPointsAtTime(timeIndex: number) {
        this.setState({ curTime: timeIndex });
        console.log('fetchPointsAtTime: %d', timeIndex);
        if (this.array === undefined && !(await this.loadArray())) {
            return;
        }
        const array = this.array;
        const maxPoints = array.shape[1] / 3;
        // TODO: somewhat arbitrary right. Should calculate some number that would
        // be reasonable for slow connections or use the chunk size.
        const trackChunkSize = 100_000;

        // Initialize the geometry attributes.
        const geometry = this.points.geometry;
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

            this.rerender()

            console.log("added points up to %d as %d", i + trackChunkSize, pointIndex);
        }
    }
}

export default Scene;
