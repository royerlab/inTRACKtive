import { Component } from 'preact';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// @ts-expect-error
import { slice, openArray } from "zarr";

class Scene extends Component {

    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private controls: OrbitControls;
    private points: THREE.Points;

    state = { n_time_points: 0 };

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

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        // bind so that "this" refers to the class instance
        let rerender = this.rerender.bind(this);
        this.controls.addEventListener('change', rerender);

        const geometry = new THREE.BufferGeometry();
        const material = new THREE.PointsMaterial({ size: 10.0, vertexColors: true });
        this.points = new THREE.Points(geometry, material);
    }

    render() {
        let n = this.state.n_time_points;
        return <div class="scene">Time points loaded: {n}</div>;
    }

    rerender() {
        this.renderer.render(this.scene, this.camera);
    }

    componentDidMount() {
        this.renderer.setClearColor(0x225555, 1);

        this.scene.add(this.points);

        this.rerender();

        setTimeout(() => {
            this.base?.appendChild(this.renderer.domElement);
        }, 1);

        this.fetchData();
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
            this.setState({ n_time_points: t + 1 });
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
}

export default Scene;
