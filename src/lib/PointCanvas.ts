import {
    AdditiveBlending,
    AxesHelper,
    BufferGeometry,
    Color,
    Float32BufferAttribute,
    FogExp2,
    Group,
    Matrix3,
    Mesh,
    MeshBasicMaterial,
    PerspectiveCamera,
    Points,
    PointsMaterial,
    Raycaster,
    Scene,
    SphereGeometry,
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
import { TransformControls } from "three/examples/jsm/Addons.js";

import { Track } from "@/lib/three/Track";
import { PointsCollection } from "@/lib/PointSelectionBox";

type Tracks = Map<number, Track>;

const raycaster = new Raycaster();
raycaster.params.Points.threshold = 1.5;

export class PointCanvas {
    scene: Scene;
    renderer: WebGLRenderer;
    camera: PerspectiveCamera;
    points: Points;
    composer: EffectComposer;
    controls: OrbitControls;
    bloomPass: UnrealBloomPass;
    tracks: Tracks = new Map();
    selectionMode: string = "box";

    showTracks = true;
    showTrackHighlights = true;

    // this is used to initialize the points geometry, and kept to initialize the
    // tracks but could be pulled from the points geometry when adding tracks
    // private here to consolidate external access via `TrackManager` instead
    private maxPointsPerTimepoint = 0;
    private setSelectedPoints: (points: PointsCollection) => void;

    pointer = new Vector2(0, 0);
    cursor = new Group();
    cursorLock = true;
    cursorControl: TransformControls;

    constructor(width: number, height: number, setSelectedPoints: (points: PointsCollection) => void) {
        this.setSelectedPoints = setSelectedPoints;
        this.scene = new Scene();
        this.renderer = new WebGLRenderer();

        this.camera = new PerspectiveCamera(
            35, // FOV
            width / height, // Aspect
            0.1, // Near
            10000, // Far
        );

        const pointsGeometry = new BufferGeometry();
        const pointsMaterial = new PointsMaterial({
            size: 16.0,
            map: new TextureLoader().load("/spark1.png"),
            vertexColors: true,
            blending: AdditiveBlending,
            depthTest: true,
            alphaTest: 0.1,
            transparent: true,
        });
        this.points = new Points(pointsGeometry, pointsMaterial);

        this.scene.add(new AxesHelper(128));
        this.scene.add(this.points);
        this.scene.fog = new FogExp2(0x000000, 0.0005); // default is 0.00025

        // Effect composition.
        const renderModel = new RenderPass(this.scene, this.camera);
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

        // Set up controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.autoRotateSpeed = 1;

        this.cursor.add(
            new Mesh(
                new SphereGeometry(25.2, 8, 8),
                new MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.5 }),
            ),
        );
        this.cursor.add(
            new Mesh(
                new SphereGeometry(25, 8, 8),
                new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 }),
            ),
        );
        this.cursorControl = new TransformControls(this.camera, this.renderer.domElement);
        this.cursorControl.size = 0.5;
        const dragingChanged = (event: { value: unknown }) => {
            this.controls.enabled = !event.value;
        };
        this.cursorControl.addEventListener("dragging-changed", dragingChanged);
        this.scene.add(this.cursor);
        this.cursorControl.attach(this.cursor);
        this.scene.add(this.cursorControl);

        this.setSelectionMode("box");

        this.renderer.domElement.addEventListener("pointermove", this.pointerMove);
        this.renderer.domElement.addEventListener("pointerup", this.pointerUp);
        this.renderer.domElement.addEventListener("wheel", this.mouseWheel);
        document.addEventListener("keydown", this.keyDown);
        document.addEventListener("keyup", this.keyUp);
    }

    setSelectionMode(mode: string) {
        console.log("setSelectionMode", mode);
        if (mode === "box") {
            this.cursor.visible = false;
            this.cursorControl.visible = false;
            this.cursorControl.enabled = false;
            this.cursorLock = true;
        } else {
            this.cursor.visible = true;
            if (mode === "spherical-cursor") {
                this.cursorControl.visible = false;
                this.cursorControl.enabled = false;
                this.cursorLock = true;
            } else if (mode === "sphere") {
                this.cursorControl.visible = true;
                this.cursorControl.enabled = true;
                this.cursorLock = true;
            }
        }
        this.selectionMode = mode;
    }

    keyDown = (event: KeyboardEvent) => {
        if (event.key === "Control") {
            this.controls.enabled = false;
        }
        if (event.key === " ") {
            this.cursorLock = false;
        }
    };

    keyUp = (event: KeyboardEvent) => {
        if (event.key === "Control") {
            this.controls.enabled = true;
        }
        if (event.key === " ") {
            this.cursorLock = true;
        }
        if (event.key === "Escape") {
            this.cursorControl.enabled = !this.cursorControl.enabled;
            this.cursorControl.visible = this.cursorControl.enabled;
            this.cursorLock = this.cursorControl.enabled;
        }
        if (event.key === "s") {
            this.cursor.visible = !this.cursor.visible;
            this.cursorControl.visible = this.cursorControl.enabled && this.cursor.visible;
        }
        if (event.key === "w") {
            this.cursorControl.setMode("translate");
        }
        if (event.key === "e") {
            this.cursorControl.setMode("rotate");
        }
        if (event.key === "r") {
            this.cursorControl.setMode("scale");
        }
    };

    mouseWheel = (event: WheelEvent) => {
        if (event.ctrlKey) {
            console.log("ctrlKey", event);
            event.preventDefault();
            this.cursor.scale.multiplyScalar(1 + event.deltaY * 0.001);
        }
    };

    pointerMove = (event: MouseEvent) => {
        if (this.cursorLock) {
            return;
        }
        const canvasElement = this.renderer.domElement.getBoundingClientRect();
        this.pointer.x = ((event.clientX - canvasElement.left) / canvasElement.width) * 2 - 1;
        this.pointer.y = (-(event.clientY - canvasElement.top) / canvasElement.height) * 2 + 1;
        raycaster.setFromCamera(this.pointer, this.camera);
        const intersects = raycaster.intersectObject(this.points);
        if (intersects.length > 0) {
            this.cursor.position.set(intersects[0].point.x, intersects[0].point.y, intersects[0].point.z);
        }
    };

    pointerUp = (event: MouseEvent) => {
        if (!event.shiftKey || !this.cursor.visible) {
            return;
        }
        // return list of points inside cursor sphere
        const radius = ((this.cursor.children[1] as Mesh).geometry as SphereGeometry).parameters.radius;
        const normalMatrix = new Matrix3();
        normalMatrix.setFromMatrix4(this.cursor.matrixWorld);
        normalMatrix.invert();
        console.log(this.cursor);
        console.log("matrix", normalMatrix);
        const center = this.cursor.position;
        const geometry = this.points.geometry;
        const positions = geometry.getAttribute("position");
        const numPoints = positions.count;
        const selected = [];
        for (let i = 0; i < numPoints; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);
            const vecToCenter = new Vector3(x, y, z).sub(center);
            const scaledVecToCenter = vecToCenter.applyMatrix3(normalMatrix);
            if (scaledVecToCenter.length() < radius) {
                selected.push(i);
            }
        }
        const points: PointsCollection = new Map();
        points.set(this.points.id, selected);
        this.setSelectedPoints(points);
        console.log("selected points:", selected);
    };

    // Use an arrow function so that each instance of the class is bound and
    // can be passed to requestAnimationFrame.
    animate = () => {
        requestAnimationFrame(this.animate);
        // Render the scene
        this.composer.render();
        this.controls.update();
    };

    setCameraProperties(position?: Vector3, target?: Vector3) {
        position && this.camera.position.set(position.x, position.y, position.z);
        target && this.controls.target.set(target.x, target.y, target.z);
    }

    highlightPoints(points: number[]) {
        const colorAttribute = this.points.geometry.getAttribute("color");
        const color = new Color();
        color.setRGB(0.9, 0.0, 0.9, SRGBColorSpace);
        for (const i of points) {
            colorAttribute.setXYZ(i, color.r, color.g, color.b);
        }
        colorAttribute.needsUpdate = true;
    }

    // This function changes the color of the points according to the point brightness slider.
    // The fadePercentage should be in [0, 1].
    fadePoints(fadePercentage: number) {
        if (!this.points.geometry.hasAttribute("color")) {
            return;
        }

        const greenAndBlueValue = 0.8 * fadePercentage;
        const colorAttribute = this.points.geometry.getAttribute("color");
        const color = new Color();
        color.setRGB(0, greenAndBlueValue, greenAndBlueValue, SRGBColorSpace);
        for (let i = 0; i < colorAttribute.count; i++) {
            colorAttribute.setXYZ(i, color.r, color.g, color.b);
        }
        colorAttribute.needsUpdate = true;
    }

    // The fadePercentage should be in [0, 1]. This argument is optional and it does not need to be
    // initialized by initPointsGeometry or reset when clearing tracks.
    resetPointColors(fadePercentage: number = 1.0) {
        if (!this.points.geometry.hasAttribute("color")) {
            return;
        }
        const color = new Color();
        color.setRGB(0.0, 0.8 * fadePercentage, 0.8 * fadePercentage, SRGBColorSpace);
        const colorAttribute = this.points.geometry.getAttribute("color");
        for (let i = 0; i < colorAttribute.count; i++) {
            colorAttribute.setXYZ(i, color.r, color.g, color.b);
        }
        colorAttribute.needsUpdate = true;
    }

    setSize(width: number, height: number) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.bloomPass.resolution.set(width, height);
        this.renderer.setSize(width, height);
        this.composer.setSize(width, height);
    }

    initPointsGeometry(maxPointsPerTimepoint: number) {
        this.maxPointsPerTimepoint = maxPointsPerTimepoint;
        const geometry = this.points.geometry;
        if (!geometry.hasAttribute("position") || geometry.getAttribute("position").count !== maxPointsPerTimepoint) {
            geometry.setAttribute(
                "position",
                new Float32BufferAttribute(new Float32Array(3 * maxPointsPerTimepoint), 3),
            );
            // prevent drawing uninitialized points at the origin
            geometry.setDrawRange(0, 0);
        }
        if (!geometry.hasAttribute("color") || geometry.getAttribute("color").count !== maxPointsPerTimepoint) {
            geometry.setAttribute("color", new Float32BufferAttribute(new Float32Array(3 * maxPointsPerTimepoint), 3));
        }
        // Initialize all the colors immediately.
        this.resetPointColors();
    }

    setPointsPositions(data: Float32Array) {
        const numPoints = data.length / 3;
        const geometry = this.points.geometry;
        const positions = geometry.getAttribute("position");
        for (let i = 0; i < numPoints; i++) {
            positions.setXYZ(i, data[3 * i], data[3 * i + 1], data[3 * i + 2]);
        }
        positions.needsUpdate = true;
        geometry.setDrawRange(0, numPoints);
        this.points.geometry.computeBoundingSphere();
    }

    addTrack(
        trackID: number,
        positions: Float32Array,
        ids: Int32Array,
        minTime: number,
        maxTime: number,
    ): Track | null {
        if (this.tracks.has(trackID)) {
            // this is a warning because it should alert us to duplicate fetching
            console.warn("Track with ID %d already exists", trackID);
            return null;
        }
        const track = Track.new(positions, ids, this.maxPointsPerTimepoint);
        track.updateAppearance(this.showTracks, this.showTrackHighlights, minTime, maxTime);
        this.tracks.set(trackID, track);
        this.scene.add(track);
        return track;
    }

    updateAllTrackHighlights(minTime: number, maxTime: number) {
        for (const track of this.tracks.values()) {
            track.updateAppearance(this.showTracks, this.showTrackHighlights, minTime, maxTime);
        }
    }

    removeTrack(trackID: number) {
        const track = this.tracks.get(trackID);
        if (track) {
            this.scene.remove(track);
            track.dispose();
            this.tracks.delete(trackID);
        } else {
            console.warn("No track with ID %d to remove", trackID);
        }
    }

    removeAllTracks() {
        for (const trackID of this.tracks.keys()) {
            this.removeTrack(trackID);
        }
        this.resetPointColors();
    }

    dispose() {
        this.renderer.dispose();
        this.removeAllTracks();
        this.points.geometry.dispose();
        if (Array.isArray(this.points.material)) {
            for (const material of this.points.material) {
                material.dispose();
            }
        } else {
            this.points.material.dispose();
        }
    }
}
