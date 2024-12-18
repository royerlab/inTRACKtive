import {
    AxesHelper,
    BufferGeometry,
    Color,
    Float32BufferAttribute,
    FogExp2,
    NormalBlending,
    PerspectiveCamera,
    Points,
    Scene,
    ShaderMaterial,
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
import { numberOfValuesPerPoint } from "./TrackManager";

import { detectedDevice } from "@/components/App.tsx";
import config from "../../CONFIG.ts";
const initialPointSize = config.settings.point_size;
const pointColor = config.settings.point_color;
const highlightPointColor = config.settings.highlight_point_color;
const previewHighlightPointColor = config.settings.preview_hightlight_point_color;

const trackWidthRatio = 0.07; // DONT CHANGE: factor of 0.07 is needed to make tracks equally wide as the points
const factorPointSizeVsCellSize = 0.1; // DONT CHANGE: this value relates the actual size of the points to the size of the points in the viewer
const factorTrackWidthVsHighlight = 3; // choice to make the tracks 7x thinner than the track highlights

// TrackType is a place to store the visual information about a track and any track-specific attributes
type TrackType = {
    threeTrack: Track;
    parentTrackID: number;
};
type Tracks = Map<number, TrackType>;

export class PointCanvas {
    readonly scene: Scene;
    readonly renderer: WebGLRenderer;
    readonly camera: PerspectiveCamera;
    readonly points: Points;
    readonly composer: EffectComposer;
    readonly controls: OrbitControls;
    readonly bloomPass: UnrealBloomPass;
    readonly selector: PointSelector;
    private axesHelper: AxesHelper | null = null;
    showAxes: boolean = true; // Track the visibility of the axes helper

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
    selectedPointIndices: number[] = [];

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
    pointSize = initialPointSize;
    trackWidthFactor = 1; // changed by track-width slider
    // this is used to initialize the points geometry, and kept to initialize the
    // tracks but could be pulled from the points geometry when adding tracks
    maxPointsPerTimepoint = 0;
    private pointIndicesCache: Map<number, number[]> = new Map();

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
        const pointVertexShader = `
            attribute float size;
            attribute vec3 color; //Declare the color attribute
            varying vec3 vColor;

            void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (300.0 / -mvPosition.z); // Adjust scaling factor
            gl_Position = projectionMatrix * mvPosition;
            }
        `;
        const pointFragmentShader = `
            varying vec3 vColor;
            uniform sampler2D pointTexture;

            void main() {
            gl_FragColor = vec4(vColor, 1.0);
            gl_FragColor = gl_FragColor * texture2D(pointTexture, gl_PointCoord);
            if (gl_FragColor.a < .5) discard;
            }
        `;

        const shaderMaterial = new ShaderMaterial({
            uniforms: {
                color: { value: new Color(0xffffff) },
                pointTexture: { value: new TextureLoader().load("/spark1.png") },
            },
            vertexShader: pointVertexShader,
            fragmentShader: pointFragmentShader,

            blending: NormalBlending,
            depthTest: true, // true
            // alphaTest: 0.1, //no effect
            depthWrite: true, // true
            transparent: false, // false
        });
        this.points = new Points(pointsGeometry, shaderMaterial);

        // this.scene.add(new AxesHelper(0.2));
        this.setupAxesHelper();
        if (detectedDevice.isPhone) {
            this.toggleAxesHelper();
        }

        this.scene.add(this.points);
        this.scene.fog = new FogExp2(0x000000, 0.0005); // default is 0.00025

        // Effect composition.
        const renderModel = new RenderPass(this.scene, this.camera);
        this.bloomPass = new UnrealBloomPass(
            new Vector2(width, height), // resolution
            0.4, // strength
            0, // radius
            0.2, // threshold
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
        if (detectedDevice.isTablet) {
            this.setSelectionMode(PointSelectionMode.SPHERE);
        } else if (detectedDevice.isPhone) {
            this.setSelectionMode(null); // no selection functionality on phone
        } else {
            this.setSelectionMode(PointSelectionMode.BOX);
        }
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
        state.selectedPointIds = Array.from(this.selectedPointIds);
        state.cameraPosition = this.camera.position.toArray();
        state.cameraTarget = this.controls.target.toArray();
        state.pointSize = this.pointSize;
        state.trackWidthFactor = this.trackWidthFactor;
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
        this.removeAllTracks(); // to make sure all tracks are removed, when the tracks are loaded from a certain state
        this.selectedPointIds = new Set(state.selectedPointIds);
        this.camera.position.fromArray(state.cameraPosition);
        this.controls.target.fromArray(state.cameraTarget);
        this.pointSize = state.pointSize;
        this.trackWidthFactor = state.trackWidthFactor;
    }

    setSelectionMode(mode: PointSelectionMode | null) {
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

    // camera only resetted upon trackManager change (new data)
    checkCameraLock(ndim: number) {
        this.controls.autoRotate = false;

        if (ndim == 2) {
            this.controls.enableRotate = false;
            console.debug("Rotation locked because 2D datast detected");
        } else if (ndim == 3) {
            this.controls.enableRotate = true;
            console.debug("Rotation enabled because 3D datast detected");
        } else {
            console.error("Invalid ndim value: " + ndim);
        }
    }

    // ran upon new data load
    resetCamera() {
        const cameraPosition = new ViewerState().cameraPosition;
        const cameraTarget = new ViewerState().cameraTarget;
        this.camera.position.set(cameraPosition[0], cameraPosition[1], cameraPosition[2]);
        this.controls.target.set(cameraTarget[0], cameraTarget[1], cameraTarget[2]);
        this.curTime = 0;
        console.debug("Camera resetted");
    }

    resetPointSize() {
        this.pointSize = initialPointSize;
        console.debug("point size resetted to: ", this.pointSize);
    }

    updateSelectedPointIndices() {
        const cacheKey = this.createCacheKey();

        // Check if the result is already cached
        if (this.pointIndicesCache.has(cacheKey)) {
            this.selectedPointIndices = this.pointIndicesCache.get(cacheKey)!;
            this.highlightPoints(this.selectedPointIndices);
            return;
        }

        // If not cached: find selectedPointIndices
        const idOffset = this.curTime * this.maxPointsPerTimepoint;
        this.selectedPointIndices = [];
        for (const track of this.tracks.values()) {
            if (this.curTime < track.threeTrack.startTime || this.curTime > track.threeTrack.endTime) continue;
            const timeIndex = this.curTime - track.threeTrack.startTime;
            const pointId = track.threeTrack.pointIds[timeIndex];
            this.selectedPointIndices.push(pointId - idOffset);
        }

        this.pointIndicesCache.set(cacheKey, this.selectedPointIndices);
        this.highlightPoints(this.selectedPointIndices);
    }

    private createCacheKey(): number {
        let hash = 0;
        const trackIds = Array.from(this.tracks.keys()).join(",");
        const keyString = `${this.curTime}:${trackIds}`;

        for (let i = 0; i < keyString.length; i++) {
            const char = keyString.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash;
    }

    clearPointIndicesCache() {
        this.pointIndicesCache.clear();
    }

    highlightPoints(points: number[]) {
        const colorAttribute = this.points.geometry.getAttribute("color");
        const color = new Color();
        color.setRGB(highlightPointColor[0], highlightPointColor[1], highlightPointColor[2], SRGBColorSpace); // pink
        for (const i of points) {
            colorAttribute.setXYZ(i, color.r, color.g, color.b);
        }
        colorAttribute.needsUpdate = true;
    }

    updatePreviewPoints() {
        if (
            this.selector.selectionMode === PointSelectionMode.SPHERICAL_CURSOR ||
            this.selector.selectionMode === PointSelectionMode.SPHERE
        ) {
            this.selector.sphereSelector.findPointsWithinSelector();
        }
    }

    highlightPreviewPoints(points: number[]) {
        const colorAttribute = this.points.geometry.getAttribute("color");
        const color = new Color();
        color.setRGB(
            previewHighlightPointColor[0],
            previewHighlightPointColor[1],
            previewHighlightPointColor[2],
            SRGBColorSpace,
        ); // yellow
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
        color.setRGB(pointColor[0], pointColor[1], pointColor[2], SRGBColorSpace); // cyan/turquoise
        color.multiplyScalar(this.pointBrightness);
        const colorAttribute = this.points.geometry.getAttribute("color");
        for (let i = 0; i < colorAttribute.count; i++) {
            colorAttribute.setXYZ(i, color.r, color.g, color.b);
        }
        colorAttribute.needsUpdate = true;
    }

    removeLastSelection() {
        this.selectedPointIds = new Set(this.fetchedPointIds);
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
        if (!geometry.hasAttribute("size") || geometry.getAttribute("size").count !== maxPointsPerTimepoint) {
            geometry.setAttribute("size", new Float32BufferAttribute(new Float32Array(maxPointsPerTimepoint), 1));
        }
        // Initialize all the colors immediately.
        this.resetPointColors();
    }

    setPointsSizes() {
        const geometry = this.points.geometry;
        const sizes = geometry.getAttribute("size");

        for (let i = 0; i < sizes.count; i++) {
            sizes.setX(i, this.pointSize);
        }
        sizes.needsUpdate = true;

        for (const track of this.tracks.values()) {
            track.threeTrack.material.trackwidth =
                (this.pointSize * trackWidthRatio * this.trackWidthFactor) / factorTrackWidthVsHighlight;
            track.threeTrack.material.highlightwidth = this.pointSize * trackWidthRatio * this.trackWidthFactor;
        }
    }

    calculateMeanCellSize(data: Float32Array, numPoints: number, num: number): number {
        let cellSizeTotal = 0;
        for (let i = 0; i < numPoints; i++) {
            cellSizeTotal = cellSizeTotal + factorPointSizeVsCellSize * data[num * i + 3];
        }
        const cellSize = cellSizeTotal / numPoints;
        return cellSize;
    }

    setPointsPositions(data: Float32Array) {
        const numPoints = data.length / numberOfValuesPerPoint;
        const geometry = this.points.geometry;
        const positions = geometry.getAttribute("position");
        const sizes = geometry.getAttribute("size");
        const num = numberOfValuesPerPoint;

        // if the point size is the initial point size and radius is provided, then we need to calculate the mean cell size once
        // ToDo: this goes wrong when a dataset without pointsize is loaded after a dataset with pointsize (because we go from num=4 to num3, but this function runs before trackManager is loaded)
        if (num == 4 && this.pointSize == initialPointSize) {
            this.pointSize = this.calculateMeanCellSize(data, numPoints, num);
            console.debug("mean cell size calculated: ", this.pointSize);
        }

        for (let i = 0; i < numPoints; i++) {
            positions.setXYZ(i, data[num * i + 0], data[num * i + 1], data[num * i + 2]);
            if (num == 4) {
                sizes.setX(i, factorPointSizeVsCellSize * data[num * i + 3]);
            } else {
                sizes.setX(i, this.pointSize);
            }
        }
        positions.needsUpdate = true;
        sizes.needsUpdate = true;
        geometry.setDrawRange(0, numPoints);
        this.points.geometry.computeBoundingSphere();
    }

    addTrack(trackID: number, positions: Float32Array, ids: Int32Array, parentTrackID: number): Track | null {
        if (this.tracks.has(trackID)) {
            // this is a warning because it should alert us to duplicate fetching
            console.warn("Track with ID %d already exists", trackID);
            return null;
        }
        const threeTrack = Track.new(positions, ids, this.maxPointsPerTimepoint);
        threeTrack.updateAppearance(
            this.showTracks,
            this.showTrackHighlights,
            this.minTime,
            this.maxTime,
            (this.pointSize * trackWidthRatio * this.trackWidthFactor) / factorTrackWidthVsHighlight, // trackWidth
            this.pointSize * trackWidthRatio * this.trackWidthFactor, // highlightWidth
        );
        this.tracks.set(trackID, { threeTrack, parentTrackID });
        this.scene.add(threeTrack);
        return threeTrack;
    }

    updateAllTrackHighlights() {
        this.tracks.forEach((track) => {
            track.threeTrack.updateAppearance(
                this.showTracks,
                this.showTrackHighlights,
                this.minTime,
                this.maxTime,
                (this.pointSize * trackWidthRatio * this.trackWidthFactor) / factorTrackWidthVsHighlight, // trackWidth
                this.pointSize * trackWidthRatio * this.trackWidthFactor, // highlightWidth
            );
        });
    }

    removeTrack(trackID: number) {
        const track = this.tracks.get(trackID);
        if (track) {
            this.scene.remove(track.threeTrack);
            track.threeTrack.dispose();
            this.tracks.delete(trackID);
        } else {
            console.warn("No track with ID %d to remove", trackID);
        }
    }

    removeAllTracks() {
        this.selectedPointIds = new Set();
        this.selectedPointIndices = [];
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

    MobileSelectCells() {
        // if used on tablet, this will select the cells upon button click
        this.selector.sphereSelector.MobileFindAndSelect();
    }

    setSelectorScale(scale: number) {
        // on tablet: this will set the size of the sphere selector upon the user using the slider
        this.selector.sphereSelector.cursor.scale.set(scale, scale, scale);
    }

    private setupAxesHelper() {
        this.axesHelper = new AxesHelper(0.2);
        this.scene.add(this.axesHelper);
    }

    // Method to toggle the axes helper visibility
    toggleAxesHelper() {
        if (this.axesHelper) {
            this.showAxes = !this.showAxes; // Toggle the visibility flag
            if (this.showAxes) {
                this.scene.add(this.axesHelper); // Add to the scene if visible
            } else {
                this.scene.remove(this.axesHelper); // Remove from the scene if not visiblev
            }
        }
    }
}
