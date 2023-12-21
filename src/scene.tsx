import { Component } from 'preact';
import { ChangeEvent } from 'preact/compat';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
// @ts-expect-error
import { ZarrArray, slice, openArray } from "zarr";

const DEFAULT_ZARR_URL = "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/tracks_benchmark/ZSNS001_tracks.zarr"

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

    state = { numTimes: 0, curTime: 0 };

    constructor() {
        super();
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(800, 600);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            35,         // FOV
            800 / 640,  // Aspect
            0.1,        // Near
            10000       // Far
        );
        this.camera.position.set(-500, 10, 15);
        this.camera.lookAt(this.scene.position);

        // postprocessing
        const renderModel = new RenderPass(this.scene, this.camera);
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(800, 600), // resolution
            0.5, // strength
            0, // radius
            0  // threshold
        );
        const outputPass = new OutputPass();
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderModel);
        this.composer.addPass(bloomPass);
        this.composer.addPass(outputPass);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        // bind so that "this" refers to the class instance
        let rerender = this.rerender.bind(this);
        this.controls.addEventListener('change', rerender);

        const geometry = new THREE.BufferGeometry();
        const material = new THREE.PointsMaterial({ size: 5.0, vertexColors: true });
        this.points = new THREE.Points(geometry, material);

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
        const numTracks = array.shape[1] / 3;
        const trackChunkSize = 100_000;

        // Initialize the geometry attributes.
        const geometry = this.points.geometry;
        const positions = new Float32Array(3 * numTracks);
        const colors = new Float32Array(3 * numTracks);
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setDrawRange(0, 0)

        // Initialize all the colors immediately.
        const color = new THREE.Color();
        const colorAttribute = geometry.getAttribute('color');
        for (let i = 0; i < numTracks; i++) {
            const r = Math.random();
            const g = Math.random();
            const b = Math.random();
            color.setRGB(r, g, b, THREE.SRGBColorSpace);
            colorAttribute.setXYZ(i, color.r, color.g, color.b);
        }
        colorAttribute.needsUpdate = true;

        // Load the positions progressively.
        const positionAttribute = geometry.getAttribute('position');
        for (let i = 0, pointIndex = 0; i < numTracks; i += trackChunkSize) {
            const start = 3 * i;
            const end = Math.min(array.shape[1], 3 * (i + trackChunkSize));
            const points = await array.get([timeIndex, slice(start, end)]);
            const coords = points.data;

            for (let j = 0; j < coords.length; j += 3) {
                if (coords[j] >= 0) {
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
