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
    Vector3,
    WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import { Track } from "@/lib/three/Track";

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
    // this is used to initialize the points geometry, and kept to initialize the
    // tracks but could be pulled from the points geometry when adding tracks
    // private here to consolidate external access via `TrackManager` instead
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
        const track = Track.new(positions, ids, this.maxPointsPerTimepoint);
        this.tracks.set(trackID, track);
        this.scene.add(track);
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
