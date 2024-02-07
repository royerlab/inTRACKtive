import {
    AdditiveBlending,
    AxesHelper,
    BufferGeometry,
    Color,
    Float32BufferAttribute,
    FogExp2,
    Group,
    Line,
    LineBasicMaterial,
    PerspectiveCamera,
    Points,
    PointsMaterial,
    Scene,
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

export class PointCanvas {
    scene: Scene;
    renderer: WebGLRenderer;
    camera: PerspectiveCamera;
    points: Points;
    tracks: Group;
    composer: EffectComposer;
    controls: OrbitControls;
    bloomPass: UnrealBloomPass;
    cellColor: Color = new Color(0x1e90ff); // DeepSkyBlue
    trackColor: Color = new Color(0xff8c00); // DarkOrange

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
        this.tracks = new Group();

        this.scene.add(new AxesHelper(128));
        this.scene.add(this.points);
        this.scene.add(this.tracks);
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
        this.resetPointColors();
        const colorAttribute = this.points.geometry.getAttribute("color");
        for (const i of points) {
            colorAttribute.setXYZ(i, this.trackColor.r, this.trackColor.g, this.trackColor.b);
        }
        colorAttribute.needsUpdate = true;
    }

    resetPointColors() {
        if (!this.points.geometry.hasAttribute("color")) {
            return;
        }
        const colorAttribute = this.points.geometry.getAttribute("color");
        for (let i = 0; i < colorAttribute.count; i++) {
            colorAttribute.setXYZ(i, this.cellColor.r, this.cellColor.g, this.cellColor.b);
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
        this.resetPointColors();
    }

    initTracksGeometry(numTracks: number, maxPoints: number) {
        console.log("initTracksGeometry: %d, %d", numTracks, maxPoints);
        // TODO: clean up with dispose.
        this.tracks.children = [];
        for (let i = 0; i < numTracks; ++i) {
            const geometry = new BufferGeometry();
            geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(3 * maxPoints), 3));
            // prevent drawing uninitialized points at the origin
            geometry.setDrawRange(0, 0);
            const material = new LineBasicMaterial({
                color: this.trackColor,
                linewidth: 2,
                linecap: "round", // ignored by WebGLRenderer
                linejoin: "round", // ignored by WebGLRenderer
            });
            const track = new Line(geometry, material);
            this.tracks.add(track);
        }
    }

    setPointsPositions(data: Array<Float32Array>) {
        console.log("setPointsPositions: %d", data.length);
        const numPoints = data.length;
        const geometry = this.points.geometry;
        const positions = geometry.getAttribute("position");
        for (let i = 0; i < numPoints; i++) {
            const point = data[i];
            // TODO: why did i put trackID first?
            positions.setXYZ(i, point[1], point[2], point[3]);
        }
        positions.needsUpdate = true;
        geometry.setDrawRange(0, numPoints);
        this.points.geometry.computeBoundingSphere();
    }

    setTracksPositions(index: number, data: Array<Float32Array>) {
        console.log("setTracksPositions: %d, %d", index, data.length);
        const numPoints = data.length;
        // TODO: store tracks explicitly as an array or similar to
        // fix typing.
        const geometry = this.tracks.children[index].geometry;
        const positions = geometry.getAttribute("position");
        for (let i = 0; i < numPoints; i++) {
            const point = data[i];
            positions.setXYZ(i, point[0], point[1], point[2]);
        }
        positions.needsUpdate = true;
        geometry.setDrawRange(0, numPoints);
        this.tracks.children[index].geometry.computeBoundingSphere();
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
