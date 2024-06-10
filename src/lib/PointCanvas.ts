import {
    AdditiveBlending,
    AxesHelper,
    BufferGeometry,
    Color,
    Float32BufferAttribute,
    FogExp2,
    PerspectiveCamera,
    Points,
    PointsMaterial,
    Scene,
    SRGBColorSpace,
    TextureLoader,
    Vector2,
    WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import { Track } from "@/lib/three/Track";
import { PointSelector, PointSelectionMode } from "@/lib/PointSelector";
import { ViewerState } from "./ViewerState";

type Tracks = Map<number, Track>;

export class PointCanvas {
    readonly scene: Scene;
    readonly renderer: WebGLRenderer;
    readonly camera: PerspectiveCamera;
    readonly points: Points;
    readonly composer: EffectComposer;
    readonly controls: OrbitControls;
    readonly bloomPass: UnrealBloomPass;
    readonly selector: PointSelector;

    // Maps from track ID to three.js Track objects.
    // This contains all tracks or tracklets across the lineages of all
    // selected cells.
    readonly tracks: Tracks = new Map();
    // Needed to skip fetches for lineages that have already been fetched.
    // TODO: storing the fetched track and point IDs here works for now,
    // but is likely a good candidate for a refactor.
    readonly fetchedRootTrackIds = new Set<number>();
    // Needed to skip fetches for point IDs that been selected.
    readonly fetchedPointIds = new Set<number>();

    // All the point IDs that have been selected.
    // PointCanvas.selector.selection is the transient array of selected
    // point indices associated with a specific time point and selection action,
    // whereas these are a union of all those selection actions, are unique
    // across the whole dataset and can be used for persistent storage.
    selectedPointIds: Set<number> = new Set();
    showTracks = true;
    showTrackHighlights = true;
    curTime: number = 0;
    minTime: number = -6;
    maxTime: number = 5;
    pointBrightness = 1.0;
    // this is used to initialize the points geometry, and kept to initialize the
    // tracks but could be pulled from the points geometry when adding tracks
    maxPointsPerTimepoint = 0;

    constructor(width: number, height: number) {
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

        // Set up selection
        this.selector = new PointSelector(this.scene, this.renderer, this.camera, this.controls, this.points);
        this.setSelectionMode(PointSelectionMode.BOX);
    }

    shallowCopy(): PointCanvas {
        const newCanvas = { ...this };
        Object.setPrototypeOf(newCanvas, PointCanvas.prototype);
        return newCanvas as PointCanvas;
    }

    toState(): ViewerState {
        const state = new ViewerState();
        state.curTime = this.curTime;
        state.minTime = this.minTime;
        state.maxTime = this.maxTime;
        state.maxPointsPerTimepoint = this.maxPointsPerTimepoint;
        state.pointBrightness = this.pointBrightness;
        state.showTracks = this.showTracks;
        state.showTrackHighlights = this.showTrackHighlights;
        state.selectedPointIds = new Array(...this.selectedPointIds);
        state.cameraPosition = this.camera.position.toArray();
        state.cameraTarget = this.controls.target.toArray();
        return state;
    }

    updateWithState(state: ViewerState) {
        this.curTime = state.curTime;
        this.minTime = state.minTime;
        this.maxTime = state.maxTime;
        this.maxPointsPerTimepoint = state.maxPointsPerTimepoint;
        this.pointBrightness = state.pointBrightness;
        this.showTracks = state.showTracks;
        this.showTrackHighlights = state.showTrackHighlights;
        this.selectedPointIds = new Set(state.selectedPointIds);
        this.camera.position.fromArray(state.cameraPosition);
        this.controls.target.fromArray(state.cameraTarget);
    }

    setSelectionMode(mode: PointSelectionMode) {
        this.selector.setSelectionMode(mode);
    }

    // Use an arrow function so that each instance of the class is bound and
    // can be passed to requestAnimationFrame.
    animate = () => {
        requestAnimationFrame(this.animate);
        // Render the scene
        this.composer.render();
        this.controls.update();
    };

    highlightPoints(points: number[]) {
        const colorAttribute = this.points.geometry.getAttribute("color");
        const color = new Color();
        color.setRGB(0.9, 0.0, 0.9, SRGBColorSpace);
        for (const i of points) {
            colorAttribute.setXYZ(i, color.r, color.g, color.b);
        }
        colorAttribute.needsUpdate = true;
    }

    resetPointColors() {
        if (!this.points.geometry.hasAttribute("color")) {
            return;
        }
        const color = new Color();
        color.setRGB(0.0, 0.8, 0.8, SRGBColorSpace);
        color.multiplyScalar(this.pointBrightness);
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

    addTrack(trackID: number, positions: Float32Array, ids: Int32Array, parentTrackID: number): Track | null {
        if (this.tracks.has(trackID)) {
            // this is a warning because it should alert us to duplicate fetching
            console.warn("Track with ID %d already exists", trackID);
            return null;
        }
        const track = Track.new(positions, ids, this.maxPointsPerTimepoint, parentTrackID);
        track.updateAppearance(this.showTracks, this.showTrackHighlights, this.minTime, this.maxTime);
        this.tracks.set(trackID, track);
        this.scene.add(track);
        return track;
    }

    updateAllTrackHighlights() {
        for (const track of this.tracks.values()) {
            track.updateAppearance(this.showTracks, this.showTrackHighlights, this.minTime, this.maxTime);
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
        this.selectedPointIds = new Set();
        this.fetchedRootTrackIds.clear();
        this.fetchedPointIds.clear();
        for (const trackID of this.tracks.keys()) {
            this.removeTrack(trackID);
        }
        this.resetPointColors();
    }

    dispose() {
        this.selector.dispose();
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
