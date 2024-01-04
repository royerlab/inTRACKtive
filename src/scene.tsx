import { Component } from 'preact';
import { ChangeEvent } from 'preact/compat';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SelectionHelper } from 'three/addons/interactive/SelectionHelper.js';
// @ts-expect-error
import { ZarrArray, slice, openArray } from "zarr";

const DEFAULT_ZARR_URL = "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/tracks_benchmark/ZSNS001_nodes.zarr"

interface SceneProps {
    renderWidth?: number;
    renderHeight?: number;
}

class Scene extends Component<SceneProps> {

    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private controls: OrbitControls;
    private points: THREE.Points;
    private composer: EffectComposer;
    private array: ZarrArray;
    private store: string;
    private path: string;
    private selectionHelper: SelectionHelper;

    state = { 
        numTimes: 0,
        curTime: 0,
        autoRotate: false,
        controlCamera: true,
    };

    constructor(props: SceneProps) {
        super(props);
        console.debug("Scene.constructor", props);

        const renderWidth = props.renderWidth || 800;
        const renderHeight = props.renderHeight || 600;

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
        // this.camera.matrixWorldAutoUpdate = true;
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(target.x, target.y, target.z);
        this.controls.autoRotate = this.state.autoRotate;
        this.controls.autoRotateSpeed = 4;
        this.controls.update();
        // bind so that "this" refers to the class instance
        this.controls.addEventListener('change', rerender);

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
        this.selectionHelper = new SelectionHelper(this.renderer, 'selectBox');
        const handlePointerUp = this.handlePointerUp.bind(this);
        const handleKeyDown = this.handleKeyDown.bind(this);
        const handleKeyUp = this.handleKeyUp.bind(this);
        document.addEventListener('pointerup', handlePointerUp);
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);

        const url = new URL(DEFAULT_ZARR_URL);
        const pathParts = url.pathname.split('/');
        this.path = pathParts.pop() || "";
        this.store = url.origin + pathParts.join('/');

        this.setControlCamera(true);
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

    handleKeyUp(event: KeyboardEvent) {
        console.log('handleKeyUp: %s', event.key);
        if (event.key === "Shift") {
            this.setControlCamera(true);
        }
    }

    handleKeyDown(event: KeyboardEvent) {
        console.log('handleKeyDown: %s', event.key);
        if (event.key === "Shift") {
            this.setControlCamera(false);
        }
    }

    nearToFar(near: THREE.Vector3, cameraPos: THREE.Vector3) {
        const far = new THREE.Vector3();
        far.copy(near);
        far.sub(cameraPos);
        far.normalize();
        far.multiplyScalar(Number.MAX_VALUE)
        far.add(cameraPos);
        return far;
    }

    handlePointerUp(event: PointerEvent) {
        if (!this.controls.enabled) {
            console.log('handlePointerUp: %d, %d', event.clientX, event.clientY);

            // Mouse to normalized render/canvas coords from:
            // https://codepen.io/boytchev/pen/NWOMrxW?editors=0011
            const canvas = this.renderer.domElement.getBoundingClientRect();

            const topLeft = this.selectionHelper.pointTopLeft;
            const bottomRight = this.selectionHelper.pointBottomRight;

            // TODO: unsure if we need to subtract canvas top-left.
            let left = (topLeft.x - canvas.left) / canvas.width * 2 - 1;
            let top = - (topLeft.y - canvas.top) / canvas.height * 2 + 1;
            let right = (bottomRight.x - canvas.left) / canvas.width * 2 - 1;
            let bottom = - (bottomRight.y - canvas.top) / canvas.height * 2 + 1;

            console.log('top = %f, left = %f, right = %f, bottom = %f', top, left, right, bottom);

            // Adapted from SelectionBox.js:
            // https://github.com/mrdoob/three.js/blob/2ab27ea33ef2c991558e392d4f476ac08975be0d/examples/jsm/interactive/SelectionBox.js#L87

            // TODO: unsure if we need this here.
            this.camera.updateProjectionMatrix();
            this.camera.updateMatrixWorld(true);

			const cameraPos = new THREE.Vector3().setFromMatrixPosition( this.camera.matrixWorld );

            const topLeftNear = new THREE.Vector3(left, top, 0).unproject(this.camera);
            const bottomRightNear = new THREE.Vector3(right, bottom, 0).unproject(this.camera);
            const topRightNear = new THREE.Vector3(right, top, 0).unproject(this.camera);
			const bottomLeftNear = new THREE.Vector3(left, bottom, 0).unproject(this.camera);

            const topLeftFar = this.nearToFar(topLeftNear, cameraPos);
            const topRightFar = this.nearToFar(topRightNear, cameraPos);
            const bottomRightFar = this.nearToFar(bottomRightNear, cameraPos);

            const frustum = new THREE.Frustum();
            const planes = frustum.planes;
            planes[0].setFromCoplanarPoints(cameraPos, topLeftNear, topRightNear); // top
            planes[1].setFromCoplanarPoints(cameraPos, topRightNear, bottomRightNear); // right
            planes[2].setFromCoplanarPoints(bottomRightNear, bottomLeftNear, cameraPos); // bottom
            planes[3].setFromCoplanarPoints(bottomLeftNear, topLeftNear, cameraPos); // left
            planes[4].setFromCoplanarPoints(topRightNear, bottomRightNear, bottomLeftNear); // near
            planes[5].setFromCoplanarPoints(bottomRightFar, topRightFar, topLeftFar); // far
            // TODO: change order of points instead?
            planes[5].normal.multiplyScalar(-1);

            const geometry = this.points.geometry;
            const colors = geometry.getAttribute('color');
            const positions = geometry.getAttribute('position');
            let numSelected = 0;
            for (let i = 0; i < positions.array.length; i += 3) {
                const pos = new THREE.Vector3(
                    positions.array[i],
                    positions.array[i+1],
                    positions.array[i+2],
                );
                if (frustum.containsPoint(pos)) {
                    colors.array[i] = 1;
                    colors.array[i+1] = 1;
                    colors.array[i+2] = 1;
                    numSelected++;
                }
            }
            console.log('selected: %d', numSelected);
            if (numSelected > 0) {
                colors.needsUpdate = true;
                this.rerender();
            }
        }
    }

    handleControlClick() {
        console.log('handleControlClick');
        this.setControlCamera(!this.controls.enabled)
    }

    setControlCamera(value: boolean) {
        this.controls.enabled = value;
        this.selectionHelper.enabled = !value;
        this.setState({controlCamera: value});
    }

    handlePlayClick() {
        console.log('handlePlayClick');
        this.setAutoRotate(!this.state.autoRotate);
        this.animate();
    }

    setAutoRotate(value: boolean) {
        this.controls.autoRotate = value;
        this.setState({ autoRotate: value });
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

    render(props: SceneProps) {
        console.debug("Scene.render", props);
        if (props.renderWidth && props.renderHeight) {
            this.renderer.setSize(props.renderWidth, props.renderHeight);
            this.composer.setSize(props.renderWidth, props.renderHeight);
            this.rerender();
        }
        let handleTimeChange = this.handleTimeChange.bind(this);
        let handleURLChange = this.handleURLChange.bind(this);
        let handlePlayClick = this.handlePlayClick.bind(this);
        let handleControlClick = this.handleControlClick.bind(this);
        let url = this.store + '/' + this.path;
        const playLabel = this.state.autoRotate ? "Stop" : "Spin";
        const controlLabel = this.state.controlCamera ? "Camera" : "Select";
        return (
            <div class="inputcontainer">
                <input
                    type="text" class="textinput" id="zarrURL"
                    value={url}
                    onChange={handleURLChange}
                    style={{ color: this.array ? "black" : "red" }}
                />
                <button id="controlButton" onClick={handleControlClick}>{controlLabel}</button>
                <button id="playButton" onClick={handlePlayClick}>{playLabel}</button>
                <input
                    type="range" min="0" max={this.state.numTimes - 1}
                    disabled={this.array === undefined}
                    value={this.state.curTime}
                    class="slider" id="timeSlider" onChange={handleTimeChange}
                />
                <label for="timeSlider">{this.state.curTime} / {this.state.numTimes}</label>
            </div>
        );
    }

    rerender() {
        this.composer.render();
    }

    animate() {
        if (this.controls.autoRotate) {
            const animate = this.animate.bind(this);
            requestAnimationFrame(animate);
            this.controls.update();
            this.rerender();
        }
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
