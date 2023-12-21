import { Component } from 'preact';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
// @ts-expect-error
import { slice, openArray } from "zarr";

class Scene extends Component {

    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private controls: OrbitControls;
    private points: THREE.Points;
    private composer: THREE.EffectComposer;

    state = { numTimes : 0 };

    constructor() {
        super();
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(800, 600);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            35,         // FOV
            800 / 640,  // Aspect
            0.1,        // Near
            10000       // Far
        );
        this.camera.position.set(-500, 10, 15);
        this.camera.lookAt(this.scene.position);

        // postprocessing
        const renderModel = new RenderPass(this.scene, this.camera);
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2( 800, 600 ), // resolution
            0.5, // strength
            0, // radius
            0  // threshold
        );
        const outputPass = new OutputPass();
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderModel);
        this.composer.addPass(bloomPass);
        this.composer.addPass(outputPass);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        // bind so that "this" refers to the class instance
        let rerender = this.rerender.bind(this);
        this.controls.addEventListener('change', rerender);

        const geometry = new THREE.BufferGeometry();
        const material = new THREE.PointsMaterial({ size: 10.0, vertexColors: true });
        this.points = new THREE.Points(geometry, material);
    }

    render() {
        const n = this.state.numTimes - 1;
        return <div class="slidecontainer"> <input type="range" min="0" max="{n}" value="0" class="slider" id="myRange"> </input> </div>;
    }

    rerender() {
        this.composer.render();
    }

    componentDidMount() {
        this.scene.add(this.points);

        this.rerender();

        setTimeout(() => {
            this.base?.appendChild(this.renderer.domElement);
        }, 1);

        this.fetchPointsAtTime(0);
    }


    async fetchData() {
        const store = "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/tracks_benchmark";
        const path = "ZSNS001_nodes.zarr";
        const array = await openArray({
            store: store,
            path: path,
            mode: "r"
        });

        const T = array.shape[0];
        const N = array.shape[1] / 3;
        const data = new Float32Array(T * N * 3);
        const color = new Float32Array(T * N * 3);
        this.points.geometry.setAttribute('position', new THREE.BufferAttribute(data, 3));
        this.points.geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
        const positionAttribute = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;
        const colorAttribute = this.points.geometry.getAttribute('color');
        // TODO: efficient fetch - this is against the chunk grain
        for (let t = 0; t < T; t++) {
            console.log(t);
            // for (let chunk = 0; chunk < array.chunks[1]; chunk++) {
            //     console.log(chunk);
            // }
            // TODO: await each chunk
            let frame = await array.get([t, slice(null)]);
            this.setState({ numTimes : t + 1 });
            // data.set(point.data, t * N * 3);
            positionAttribute.set(frame.data, t * N * 3);
            // TODO: is there a way to do this via the buffer?
            color.fill(t / T, t * N * 3, (t + 1) * N * 3);
            this.points.geometry.setDrawRange(0, (t + 1) * N);
            positionAttribute.needsUpdate = true;
            colorAttribute.needsUpdate = true;
            // console.log(frame);
            this.rerender();
        }
        // TODO: fetch more than one point at a time, this is a lot of requests
        // for (let i = 0; i < N; i++) {
        //     let point = await array.get([0, slice(i * 3, (i + 1) * 3)]);
        //     data.set(point.data, i * 3);
        //     this.points_geometry.setAttribute('position', new THREE.BufferAttribute(data, 3));
        //     // console.log(point);
        //     if (i % 100 == 0) {
        //         this.rerender();
        //     }
        // }
        console.log(data);
        this.rerender();
    }

    async fetchPointsAtTime(timeIndex: number) {
        const store = "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/tracks_benchmark";
        const path = "ZSNS001_tracks.zarr";
        const array = await openArray({
            store: store,
            path: path,
            mode: "r"
        });
        this.setState({ numTimes : array.shape[0] });
        const numTracks = array.shape[1] / 3;
        const trackChunkSize = 100000;

        // Initialize the geometry attributes.
        const geometry = this.points.geometry;
        const positions = new Float32Array( 3 * numTracks );
        const colors = new Float32Array( 3 * numTracks );
        geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
        geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
        geometry.setDrawRange( 0, 0 )
    
        // Initialize all the colors immediately.
        const color = new THREE.Color();
        const colorAttribute = geometry.getAttribute( 'color' );
        for ( let i = 0; i < numTracks; i++ ) {
            const r = Math.random();
            const g = Math.random();
            const b = Math.random();
            color.setRGB( r, g, b, THREE.SRGBColorSpace );
            colorAttribute.setXYZ( i, color.r, color.g, color.b );
        }
        colorAttribute.needsUpdate = true;

        // Load the positions progressively.
        const positionAttribute = geometry.getAttribute('position');
        for (let i = 0, pointIndex = 0; i < numTracks; i += trackChunkSize) {
            const start = 3 * i;
            const end = 3 * (i + trackChunkSize);
            const points = await array.get([timeIndex, slice(start, end)]);
            const coords = points.data;

            for (let j = 0; j < coords.length; j += 3) {
                if (coords[j] >= 0) {
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
