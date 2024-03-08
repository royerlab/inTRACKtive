import {
    AdditiveBlending,
    AxesHelper,
    BufferGeometry,
    Color,
    Float32BufferAttribute,
    FogExp2,
    Object3D,
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
import { Line2, LineGeometry, LineMaterial, Lut } from "three/examples/jsm/Addons.js";

type Tracks = Map<number, Track>;

export class PointCanvas {
    scene: Scene;
    renderer: WebGLRenderer;
    camera: PerspectiveCamera;
    points: Points;
    composer: EffectComposer;
    controls: OrbitControls;
    bloomPass: UnrealBloomPass;
    tracks: Tracks = new Map();
    // TODO: perhaps don't want to store this here...
    // it's used to initialize the points geometry, and kept to initialize the
    // tracks but could be pulled from the points geometry when adding tracks
    private maxPointsPerTimepoint = 0;

    constructor(width: number, height: number) {
        this.scene = new Scene();
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

        const pointsGeometry = new BufferGeometry();
        const pointsMaterial = new PointsMaterial({
            size: 16.0,
            map: new TextureLoader().load("/spark1.png"),
            vertexColors: true,
            blending: AdditiveBlending,
            depthTest: false,
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

    addTrack(trackID: number, positions: Float32Array, ids: Int32Array, curTime?: number, length?: number) {
        if (this.tracks.has(trackID)) {
            // this is a warning because it should alert us to duplicate fetching
            console.warn("Track with ID %d already exists", trackID);
            return;
        }
        const track = new Track(trackID, positions, ids, this.maxPointsPerTimepoint, curTime, length);
        this.tracks.set(trackID, track);
        this.scene.add(track);
    }

    updateAllTrackHighlights(curTime: number, length: number) {
        const halfLength = Math.floor(length / 2);
        const minTime = curTime - halfLength;
        const maxTime = curTime + halfLength;
        for (const track of this.tracks.values()) {
            const ids = track.updateHighlightLine(curTime, minTime, maxTime);
            ids && this.highlightPoints(ids.map((id) => id % this.maxPointsPerTimepoint));
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

// TODO: this (or the map it's stored in) could contain more lineage
// information for richer visualization
class Track extends Object3D {
    trackID: number;

    positions: Float32Array;
    pointIDs: Int32Array;
    time: number[] = [];

    trackLine: Line2 | null = null;

    highlightLine: Line2 | null = null;
    highlightLUT = new Lut("blackbody", 128);

    constructor(
        trackID: number,
        positions: Float32Array,
        pointIDs: Int32Array,
        maxPointsPerTimepoint: number,
        curTime?: number,
        length?: number,
    ) {
        super();
        this.trackID = trackID;
        this.positions = positions;
        this.pointIDs = pointIDs;
        this.initTrackLine(maxPointsPerTimepoint);
        this.initHighlightLine(curTime, length);
    }

    private makeLine(linewidth: number, opacity?: number): Line2 {
        const geometry = new LineGeometry();
        const material = new LineMaterial({
            vertexColors: true,
            worldUnits: true,
            linewidth: linewidth,
            transparent: opacity !== undefined,
            opacity: opacity ?? 1.0,
        });
        const line = new Line2(geometry, material);
        this.add(line);
        return line;
    }

    private initHighlightLine(curTime?: number, length?: number) {
        this.highlightLine = this.makeLine(1.0);
        if (curTime !== undefined && length !== undefined) {
            const halfLength = Math.floor(length / 2);
            const minTime = curTime - halfLength;
            const maxTime = curTime + halfLength;
            this.updateHighlightLine(curTime, minTime, maxTime);
        }
    }

    private initTrackLine(maxPointsPerTimepoint: number) {
        this.trackLine = this.makeLine(0.3, 0.5);

        this.time = [];
        const pos = Array.from(this.positions);
        const colors: number[] = [];
        const n = pos.length / 3;
        for (const [i, id] of this.pointIDs.entries()) {
            const t = Math.floor(id / maxPointsPerTimepoint);
            this.time.push(t);
            // TODO: use a LUT for this
            colors.push(((0.9 * (n - i)) / n) ** 3, ((0.9 * (n - i)) / n) ** 3, (0.9 * (n - i)) / n);
        }
        this.trackLine.geometry.setPositions(pos);
        this.trackLine.geometry.setColors(colors);
        this.trackLine.geometry.computeBoundingSphere();
    }

    updateHighlightLine(curTime: number, minTime: number, maxTime: number) {
        if (!this.highlightLine || !this.trackLine) {
            console.warn("Highlight line or track line not initialized", this.trackID);
            return;
        }
        if (minTime > this.time[this.time.length - 1] || maxTime < this.time[0]) {
            // don't draw this highlight
            this.highlightLine.visible = false;
            return;
        }
        this.highlightLine.visible = true;

        let minIdx = this.time.findIndex((t) => t === minTime);
        let maxIdx = this.time.findIndex((t) => t === maxTime);

        minIdx = minIdx === -1 ? 0 : minIdx;
        maxIdx = maxIdx === -1 ? this.time.length - 1 : maxIdx;

        const positions: number[] = [];
        const colors: number[] = [];
        const highlightPoints: number[] = [];
        for (let i = minIdx; i <= maxIdx; i++) {
            positions.push(this.positions[3 * i], this.positions[3 * i + 1], this.positions[3 * i + 2]);
            const lengthFrac = (this.time[i] - minTime) / (maxTime - minTime);
            colors.push(...this.highlightLUT.getColor(lengthFrac).toArray());
            this.time[i] === curTime && highlightPoints.push(this.pointIDs[i]);
        }

        // TODO: it's wasteful to create a new geometry every time
        // but otherwise the line length doesn't seem to update
        const geometry = new LineGeometry();
        geometry.setPositions(positions);
        geometry.setColors(colors);
        this.highlightLine.geometry.dispose();
        this.highlightLine.geometry = geometry;

        return highlightPoints;
    }

    dispose() {
        for (const line of [this.highlightLine, this.trackLine]) {
            if (line) {
                line.geometry.dispose();
                if (Array.isArray(line.material)) {
                    for (const material of line.material) {
                        material.dispose();
                    }
                } else {
                    line.material.dispose();
                }
            }
        }
    }
}
