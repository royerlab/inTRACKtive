import {
    AdditiveBlending,
    AxesHelper,
    BufferGeometry,
    Color,
    DataTexture,
    Float32BufferAttribute,
    FogExp2,
    PerspectiveCamera,
    Points,
    PointsMaterial,
    RGBAFormat,
    Scene,
    SRGBColorSpace,
    TextureLoader,
    UnsignedByteType,
    Vector2,
    Vector3,
    WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import { TrackLine } from "./lib/three/TrackLine.ts";
import { TrackGeometry } from "./lib/three/TrackGeometry.ts";
import { TrackMaterial } from "./lib/three/TrackMaterial.ts";
import { Lut } from "three/examples/jsm/math/Lut.js";

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

    addTrack(trackID: number, positions: Float32Array, ids: Int32Array): Track | null {
        if (this.tracks.has(trackID)) {
            // this is a warning because it should alert us to duplicate fetching
            console.warn("Track with ID %d already exists", trackID);
            return null;
        }
        const track = new Track(trackID, positions, ids, this.maxPointsPerTimepoint);
        this.tracks.set(trackID, track);
        this.scene.add(track.trackLine);
        return track;
    }

    updateAllTrackHighlights(minTime: number, maxTime: number) {
        for (const track of this.tracks.values()) {
            track.updateHighlightLine(minTime, maxTime);
        }
    }

    removeTrack(trackID: number) {
        const track = this.tracks.get(trackID);
        if (track) {
            this.scene.remove(track.trackLine);
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

// TODO: this could perhaps go in TrackMaterial.ts or something
const highlightLUT = new Lut();
highlightLUT.addColorMap("plasma", [
    [0.0, 0x000004],
    [0.1, 0x160b39],
    [0.2, 0x420a68],
    [0.3, 0x6a176e],
    [0.4, 0x932667],
    [0.5, 0xbc3754],
    [0.6, 0xdd513a],
    [0.7, 0xf37819],
    [0.8, 0xfca50a],
    [0.9, 0xf6d746],
    [1.0, 0xfcffa4],
]);
highlightLUT.setColorMap("plasma");
const lutArray = new Uint8Array(128 * 4);
for (let i = 0; i < 128; i++) {
    const color = highlightLUT.getColor(i / 128);
    lutArray[i * 4] = color.r * 255;
    lutArray[i * 4 + 1] = color.g * 255;
    lutArray[i * 4 + 2] = color.b * 255;
    lutArray[i * 4 + 3] = 255;
}
const highlightLUTTexture = new DataTexture(lutArray, 128, 1, RGBAFormat, UnsignedByteType);
highlightLUTTexture.colorSpace = SRGBColorSpace;
highlightLUTTexture.needsUpdate = true;

// TODO: this (or the map it's stored in) could contain more lineage
// information for richer visualization
class Track {
    trackID: number;

    positions: Float32Array;
    pointIDs: Int32Array;

    trackLine: TrackLine;
    highlightLUTTexture = highlightLUTTexture;

    constructor(trackID: number, positions: Float32Array, pointIDs: Int32Array, maxPointsPerTimepoint: number) {
        this.trackID = trackID;
        this.positions = positions;
        this.pointIDs = pointIDs;

        const geometry = new TrackGeometry();
        const material = new TrackMaterial({
            vertexColors: true,
            trackwidth: 0.3,
            highlightwidth: 2.0,
            highlightLUT: this.highlightLUTTexture,
            showtrack: true,
            transparent: true,
            opacity: 0.5,
        });
        this.trackLine = new TrackLine(geometry, material);

        const time: number[] = [];
        const pos = Array.from(this.positions);
        const colors: number[] = [];
        const n = pos.length / 3;
        for (const [i, id] of this.pointIDs.entries()) {
            const t = Math.floor(id / maxPointsPerTimepoint);
            time.push(t);
            // TODO: use a LUT for the main track, too
            colors.push(((0.9 * (n - i)) / n) ** 3, ((0.9 * (n - i)) / n) ** 3, (0.9 * (n - i)) / n);
        }
        this.trackLine.geometry.setPositions(pos);
        this.trackLine.geometry.setColors(colors);
        this.trackLine.geometry.setTime(time);
        this.trackLine.geometry.computeBoundingSphere();
    }

    updateHighlightLine(minTime: number, maxTime: number) {
        if (this.trackLine) {
            this.trackLine.material.minTime = minTime;
            this.trackLine.material.maxTime = maxTime;
            this.trackLine.material.needsUpdate = true;
        }
        return;
    }

    dispose() {
        if (this.trackLine) {
            this.trackLine.geometry.dispose();
            if (Array.isArray(this.trackLine.material)) {
                for (const material of this.trackLine.material) {
                    material.dispose();
                }
            } else {
                this.trackLine.material.dispose();
            }
        }
    }
}
