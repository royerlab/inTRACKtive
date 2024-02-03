import {
    AdditiveBlending,
    AxesHelper,
    BufferGeometry,
    Color,
    Float32BufferAttribute,
    FogExp2,
    Line,
    LineBasicMaterial,
    LineSegments,
    PerspectiveCamera,
    Points,
    PointsMaterial,
    Scene,
    SRGBColorSpace,
    TextureLoader,
    Vector2,
    Vector3,
    WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SelectionHelper } from "three/addons/interactive/SelectionHelper.js";
import { PointSelectionBox } from "./PointSelectionBox";

export class PointCanvas {
    renderer: WebGLRenderer;
    camera: PerspectiveCamera;
    points: Points;
    viewedIds: Array<number>;
    tracks: Line;
    composer: EffectComposer;
    controls: OrbitControls;
    bloomPass: UnrealBloomPass;
    selectionBox: PointSelectionBox;
    selectionHelper: SelectionHelper;
    onSelectedChanged: Function;

    constructor(width: number, height: number, onSelectedChanged: Function) {
        this.viewedIds = [];
        this.onSelectedChanged = onSelectedChanged;
        const scene = new Scene();
        this.renderer = new WebGLRenderer();

        this.camera = new PerspectiveCamera(
            35, // FOV
            width / height, // Aspect
            0.1, // Near
            10000, // Far
        );
        // Default position from interacting with ZSNS001
        // TODO: this should be set/reset when the data changes
        const target = new Vector3(500, 500, 250);
        this.camera.position.set(target.x, target.y, target.z - 1500);
        this.camera.lookAt(target.x, target.y, target.z);

        const geometry = new BufferGeometry();
        const material = new PointsMaterial({
            size: 16.0,
            map: new TextureLoader().load("/spark1.png"),
            vertexColors: true,
            blending: AdditiveBlending,
            depthTest: false,
            transparent: true,
        });
        this.points = new Points(geometry, material);

        const trackGeometry = new BufferGeometry();
        const trackMaterial = new LineBasicMaterial( {
            color: 0xffffff,
            linewidth: 1,
            linecap: 'round', //ignored by WebGLRenderer
            linejoin:  'round' //ignored by WebGLRenderer
        } );
        this.tracks = new Line(trackGeometry, trackMaterial);

        scene.add(new AxesHelper(128));
        scene.add(this.points);
        scene.add(this.tracks);
        scene.fog = new FogExp2(0x000000, 0.0005); // default is 0.00025

        // Effect composition.
        const renderModel = new RenderPass(scene, this.camera);
        this.bloomPass = new UnrealBloomPass(
            new Vector2(width, height), // resolution
            0.4, // strength
            0, // radius
            0, // threshold
        );
        const outputPass = new OutputPass();
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderModel);
        this.composer.addPass(this.bloomPass);
        this.composer.addPass(outputPass);

        // Point selection
        this.selectionHelper = new SelectionHelper(this.renderer, "selectBox");
        this.selectionHelper.enabled = false;
        this.selectionBox = new PointSelectionBox(this.camera, scene);
        // TODO: improve the behavior when pressing/releasing the mouse and
        // shift key in different orders
        this.renderer.domElement.addEventListener("pointerup", this.pointerUp);

        // Set up controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(target.x, target.y, target.z);
        this.controls.autoRotateSpeed = 1;
    }

    // Use an arrow function so that each instance of the class is bound and
    // can be passed to requestAnimationFrame.
    animate = () => {
        requestAnimationFrame(this.animate);
        // Render the scene
        this.composer.render();
        this.controls.update();
    };

    // Use an arrow function so that each instance of the class is bound and
    // can be used as a callback.
    pointerUp = () => {
        console.log("pointerUp: %s", this.selectionHelper.enabled);
        if (this.selectionHelper && this.selectionHelper.enabled) {
            // Mouse to normalized render/canvas coords from:
            // https://codepen.io/boytchev/pen/NWOMrxW?editors=0011
            const canvas = this.renderer.domElement.getBoundingClientRect();

            const topLeft = this.selectionHelper.pointTopLeft;
            const left = ((topLeft.x - canvas.left) / canvas.width) * 2 - 1;
            const top = (-(topLeft.y - canvas.top) / canvas.height) * 2 + 1;

            const bottomRight = this.selectionHelper.pointBottomRight;
            const right = ((bottomRight.x - canvas.left) / canvas.width) * 2 - 1;
            const bottom = (-(bottomRight.y - canvas.top) / canvas.height) * 2 + 1;
            console.debug("selectionHelper, top = %f, left = %f, bottom = %f, right = %f", top, left, bottom, right);

            // TODO: check the z-value of these points
            this.selectionBox.startPoint.set(left, top, 0.5);
            this.selectionBox.endPoint.set(right, bottom, 0.5);

            // TODO: consider restricting selection to a specific object
            const selection = this.selectionBox.select();
            console.debug("selected points:", selection);

            if (this.points && this.points.id in selection) {
                const colors = this.points.geometry.getAttribute("color");
                const color = new Color(0xffffff);
                for (const i of selection[this.points.id]) {
                    colors.setXYZ(i, color.r, color.g, color.b);
                }
                colors.needsUpdate = true;
            }

            let selectedIds = [];
            if (selection) {
                selectedIds = Object.values(selection)[0]
                    .map((index: number) => this.viewedIds[index]);
                console.debug("viewed IDs:", this.viewedIds);
                console.debug("selected IDs:", selectedIds);
            }
            this.onSelectedChanged(selectedIds);
        }
    };

    setSize(width: number, height: number) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.bloomPass.resolution.set(width, height);
        this.renderer.setSize(width, height);
        this.composer.setSize(width, height);
    }

    setSelecting(selecting: boolean) {
        this.selectionHelper.enabled = selecting;
        this.controls.enabled = !selecting;
    }

    initPointsGeometry(numPoints: number) {
        const geometry = this.points.geometry;
        if (!geometry.hasAttribute("position") || geometry.getAttribute("position").count !== numPoints) {
            geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(3 * numPoints), 3));
            // prevent drawing uninitialized points at the origin
            geometry.setDrawRange(0, 0);
        }
        if (!geometry.hasAttribute("color") || geometry.getAttribute("color").count !== numPoints) {
            geometry.setAttribute("color", new Float32BufferAttribute(new Float32Array(3 * numPoints), 3));
        }

        // Initialize all the colors immediately.
        const color = new Color();
        const colorAttribute = geometry.getAttribute("color");
        for (let i = 0; i < numPoints; i++) {
            const r = Math.random();
            const g = Math.random();
            const b = Math.random();
            color.setRGB(r, g, b, SRGBColorSpace);
            colorAttribute.setXYZ(i, color.r, color.g, color.b);
        }
        colorAttribute.needsUpdate = true;
    }

    initTracksGeometry(numPoints: number) {
        const geometry = this.tracks.geometry;
        if (!geometry.hasAttribute("position") || geometry.getAttribute("position").count !== numPoints) {
            geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(3 * numPoints), 3));
            // prevent drawing uninitialized points at the origin
            geometry.setDrawRange(0, 0);
        }
        if (!geometry.hasAttribute("color") || geometry.getAttribute("color").count !== numPoints) {
            geometry.setAttribute("color", new Float32BufferAttribute(new Float32Array(3 * numPoints), 3));
        }
    }

    setPointsPositions(data: Array<Float32Array>) {
        console.log("setPointsPositions: %d", data.length);
        const numPoints = data.length;
        const geometry = this.points.geometry;
        const positions = geometry.getAttribute("position");
        this.viewedIds = [];
        for (let i = 0; i < numPoints; i++) {
            const point = data[i];
            this.viewedIds.push(point[0]);
            // TODO: why did i put trackID first?
            positions.setXYZ(i, point[1], point[2], point[3]);
        }
        positions.needsUpdate = true;
        geometry.setDrawRange(0, numPoints);
        this.points.geometry.computeBoundingSphere();
    }

    setTracksPositions(data: Array<Float32Array>) {
        console.log("setTracksPositions: %d", data.length);
        const numPoints = data.length;
        const geometry = this.tracks.geometry;
        const positions = geometry.getAttribute("position");
        for (let i = 0; i < numPoints; i++) {
            const point = data[i];
            // console.log("setTrackPosition: %d, %f, %f, %f", i, point[0], point[1], point[2]);
            positions.setXYZ(i, point[0], point[1], point[2]);
        }
        positions.needsUpdate = true;
        geometry.setDrawRange(0, numPoints);
        this.tracks.geometry.computeBoundingSphere();
    }

    dispose() {
        this.renderer.domElement.removeEventListener("pointerup", this.pointerUp);
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
