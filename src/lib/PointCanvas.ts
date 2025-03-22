import {
    AxesHelper,
    BufferAttribute,
    BufferGeometry,
    Color,
    Float32BufferAttribute,
    FogExp2,
    InterleavedBufferAttribute,
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
import { numberOfValuesPerPoint, Option, DEFAULT_DROPDOWN_OPTION } from "./TrackManager";
import { colormaps } from "@/lib/Colormaps";

import deviceState from "./DeviceState.ts";
import config from "../../CONFIG.ts";
const initialPointSize = config.settings.point_size;
const pointColor = config.settings.point_color;
const highlightPointColor = config.settings.highlight_point_color;
const previewHighlightPointColor = config.settings.preview_hightlight_point_color;
const colormapColorbyCategorical = config.settings.colormap_colorby_categorical;
const colormapColorbyContinuous = config.settings.colormap_colorby_continuous;

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
    colorBy: boolean = false;
    colorByEvent: Option = DEFAULT_DROPDOWN_OPTION;
    currentAttributes: number[] | Float32Array = new Float32Array();
    previousNumValues = 4;

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
        if (deviceState.current.isPhone) {
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
        if (deviceState.current.isTablet) {
            this.setSelectionMode(PointSelectionMode.SPHERE);
        } else if (deviceState.current.isPhone) {
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
        state.colorBy = this.colorBy;
        state.colorByEvent = this.colorByEvent;
        state.selectionMode = this.selector.selectionMode;

        // Add sphere selector state
        if (this.selector.sphereSelector) {
            state.sphereSelector = {
                position: this.selector.sphereSelector.cursor.position.toArray() as [number, number, number],
                scale: this.selector.sphereSelector.cursor.scale.toArray() as [number, number, number],
                rotation: this.selector.sphereSelector.cursor.rotation.toArray() as [number, number, number],
                visible: this.selector.sphereSelector.cursor.visible,
            };
        }
        return state;
    }

    updateWithState(state: ViewerState) {
        const defaultState = new ViewerState();

        this.curTime = state.curTime ?? defaultState.curTime;
        this.minTime = state.minTime ?? defaultState.minTime;
        this.maxTime = state.maxTime ?? defaultState.maxTime;
        this.maxPointsPerTimepoint = state.maxPointsPerTimepoint ?? defaultState.maxPointsPerTimepoint;
        this.pointBrightness = state.pointBrightness ?? defaultState.pointBrightness;
        this.showTracks = state.showTracks ?? defaultState.showTracks;
        this.showTrackHighlights = state.showTrackHighlights ?? defaultState.showTrackHighlights;
        this.removeAllTracks();
        this.selectedPointIds = new Set(state.selectedPointIds ?? []);
        this.camera.position.fromArray(state.cameraPosition ?? defaultState.cameraPosition);
        this.controls.target.fromArray(state.cameraTarget ?? defaultState.cameraTarget);
        this.pointSize = state.pointSize ?? defaultState.pointSize;
        this.trackWidthFactor = state.trackWidthFactor ?? defaultState.trackWidthFactor;
        this.colorBy = state.colorBy ?? defaultState.colorBy;
        this.colorByEvent = state.colorByEvent ?? defaultState.colorByEvent;

        // Respect device constraints when setting selection mode
        let newSelectionMode = state.selectionMode ?? defaultState.selectionMode;
        if (deviceState.current.isPhone) {
            newSelectionMode = null; // no selection on phone
        } else if (deviceState.current.isTablet) {
            newSelectionMode = PointSelectionMode.SPHERE; // force sphere on tablet
        }
        this.selector.selectionMode = newSelectionMode;

        // Update sphere selector
        if (this.selector.sphereSelector && state.sphereSelector) {
            this.selector.sphereSelector.cursor.position.fromArray(
                state.sphereSelector.position ?? defaultState.sphereSelector.position,
            );
            this.selector.sphereSelector.cursor.scale.fromArray(
                state.sphereSelector.scale ?? defaultState.sphereSelector.scale,
            );
            this.selector.sphereSelector.cursor.rotation.fromArray(
                state.sphereSelector.rotation ?? defaultState.sphereSelector.rotation,
            );
            this.selector.sphereSelector.cursor.visible =
                state.sphereSelector.visible ?? defaultState.sphereSelector.visible;
            if (deviceState.current.isTablet) {
                this.selector.sphereSelector.cursor.visible = true;
                if (
                    (state.selectionMode === PointSelectionMode.SPHERE ||
                        state.selectionMode === PointSelectionMode.SPHERICAL_CURSOR) &&
                    !state.sphereSelector.visible
                ) {
                    this.selector.sphereSelector.cursor.visible = false;
                }
            }
        }
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
            console.debug("Rotation locked because 2D dataset detected");
        } else if (ndim == 3) {
            this.controls.enableRotate = true;
            console.debug("Rotation enabled because 3D dataset detected");
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
        console.debug("Camera reset");
    }

    resetPointSize() {
        this.pointSize = initialPointSize;
        console.debug("point size reset to: ", this.pointSize);
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

    resetPointColors(attributesInput?: Float32Array) {
        if (!this.points.geometry.hasAttribute("color")) {
            return;
        }

        const colorAttribute = this.points.geometry.getAttribute("color");
        const geometry = this.points.geometry;
        const numPoints = geometry.drawRange.count;
        const positions = geometry.getAttribute("position");

        let attributes;
        if (this.colorByEvent.action === "default") {
            attributes = new Float32Array(numPoints).fill(1); // all 1
            console.debug("Default attributes (1)");
        } else {
            if (this.colorByEvent.action === "calculate") {
                attributes = this.calculateAttributeVector(positions, this.colorByEvent, numPoints); // calculated attributes based on position
                console.debug("Attributes calculated");
            } else if (this.colorByEvent.action === "provided" || this.colorByEvent.action === "provided-normalized") {
                if (attributesInput) {
                    attributes = attributesInput; // take provided attributes fetched from Zarr
                    this.currentAttributes = attributes;
                    console.debug("Attributes provided, using attributesInput");
                } else {
                    attributes = this.currentAttributes;
                    console.debug("No attributes provided, using currentAttributes");
                }
            } else {
                console.error("Invalid action type for colorByEvent:", this.colorByEvent.action);
            }
            if (attributes) {
                if (
                    this.colorByEvent.action != "provided-normalized" &&
                    attributes.length > 0 &&
                    this.colorByEvent.type != "hex"
                ) {
                    attributes = this.normalizeAttributeVector(attributes);
                }
            } else {
                attributes = new Float32Array(numPoints).fill(1);
                console.error("No attributes found for colorByEvent:", this.colorByEvent);
            }
        }

        if (this.colorByEvent.type === "default") {
            const color = new Color();
            color.setRGB(pointColor[0], pointColor[1], pointColor[2], SRGBColorSpace); // cyan/turquoise
            color.multiplyScalar(this.pointBrightness);
            for (let i = 0; i < numPoints; i++) {
                colorAttribute.setXYZ(i, color.r, color.g, color.b);
            }
        } else if (this.colorByEvent.type === "hex") {
            for (let i = 0; i < numPoints; i++) {
                const hexInt = attributes[i]; // must be [0 1]
                if (hexInt === undefined) {
                    console.warn("Invalid hexInt value:", hexInt);
                    continue; // skip this iteration
                }
                const hexStr = `#${hexInt.toString(16).padStart(6, "0").toUpperCase()}`;
                const color = new Color(hexStr);
                color.multiplyScalar(this.pointBrightness);
                colorAttribute.setXYZ(i, color.r, color.g, color.b);
            }
        } else {
            const color = new Color();
            if (this.colorByEvent.type === "categorical") {
                colormaps.setColorMap(colormapColorbyCategorical, 50);
            } else if (this.colorByEvent.type === "continuous") {
                colormaps.setColorMap(colormapColorbyContinuous, 50);
            }
            for (let i = 0; i < numPoints; i++) {
                const scalar = attributes[i]; // must be [0 1]
                const colorOfScalar = colormaps.getColor(scalar); // remove the bright/dark edges of colormap
                // const colorOfScalar = colormaps.getColor(scalar*0.8+0.1); //remove the bright/dark edges of colormap
                color.setRGB(colorOfScalar.r, colorOfScalar.g, colorOfScalar.b, SRGBColorSpace);
                color.multiplyScalar(this.pointBrightness);
                colorAttribute.setXYZ(i, color.r, color.g, color.b);
            }
        }
        colorAttribute.needsUpdate = true;
    }

    calculateAttributeVector(
        positions: BufferAttribute | InterleavedBufferAttribute,
        colorByEvent: Option,
        numPoints: number,
    ): number[] {
        const attributeVector = [];

        for (let i = 0; i < numPoints; i++) {
            if (colorByEvent.name === "uniform") {
                attributeVector.push(1); // constant color
            } else if (colorByEvent.name === "x-position") {
                attributeVector.push(positions.getX(i) + 1000); // color based on X coordinate
            } else if (colorByEvent.name === "y-position") {
                attributeVector.push(positions.getY(i)); // color based on Y coordinate
            } else if (colorByEvent.name === "z-position") {
                attributeVector.push(positions.getZ(i)); // color based on Z coordinate
            } else if (colorByEvent.name === "sign(x-pos)") {
                const bool = positions.getX(i) < 0;
                attributeVector.push(bool ? 0 : 1); // color based on X coordinate (2 groups)
            } else if (colorByEvent.name === "quadrants") {
                const x = positions.getX(i) > 0 ? 1 : 0;
                const y = positions.getY(i) > 0 ? 1 : 0;
                const z = positions.getZ(i) > 0 ? 1 : 0;
                const quadrant = x + y * 2 + z * 4; //
                attributeVector.push(quadrant); // color based on XY coordinates (4 groups)
            } else {
                attributeVector.push(1); // default to constant color if event type not recognized
                console.error("Invalid colorByEvent name to be calculated from data:", colorByEvent.name);
            }
        }

        return attributeVector;
    }

    normalizeAttributeVector(attributes: number[] | Float32Array): number[] | Float32Array {
        const min = Math.min(...attributes);
        const max = Math.max(...attributes);
        const range = max - min;

        // Avoid division by zero in case all values are the same
        if (range === 0) {
            return attributes.map(() => 1); // Arbitrary choice: map all to the midpoint (0.5)
        }

        return attributes.map((value) => (value - min) / range);
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

    updatePointsSizes() {
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

        // Only reset pointSize when switching from num=4 to num=3
        if (num === 3 && this.previousNumValues === 4) {
            this.pointSize = initialPointSize;
            console.debug("Reset to initial point size");
        }
        this.previousNumValues = num;

        // Only calculate mean cell size when num=4 and using initial point size
        if (num === 4 && this.pointSize === initialPointSize) {
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
