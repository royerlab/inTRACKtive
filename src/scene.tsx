import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

interface SceneProps {
    renderWidth?: number;
    renderHeight?: number;
}

export default function Scene(props: SceneProps) {

    const renderWidth = props.renderWidth || 800;
    const renderHeight = props.renderHeight || 600;

    // Use references here to avoid adding dependencies in the below useEffect
    const divRef: React.RefObject<HTMLDivElement> = useRef(null);
    const renderer = useRef<THREE.WebGLRenderer>();
    const scene = useRef<THREE.Scene>();
    const camera = useRef<THREE.PerspectiveCamera>();
    const controls = useRef<OrbitControls>();
    const aspect = useRef(renderWidth / renderHeight);

    // useEffect here is intended to make this part run only on mount
    useEffect(() => {
        // Initialize renderer
        renderer.current = new THREE.WebGLRenderer();
        divRef.current?.appendChild(renderer.current.domElement);
        scene.current = new THREE.Scene();
        camera.current = new THREE.PerspectiveCamera(
            35,              // FOV
            aspect.current,  // Aspect
            0.1,             // Near
            10000            // Far
        );

        scene.current.add(new THREE.AxesHelper(128));

        // Default position from interacting with ZSNS001
        // TODO: this should be reset when the data URI changes
        const target = new THREE.Vector3(500, 500, 250);
        camera.current.position.set(target.x, target.y, target.z - 1500);
        camera.current.lookAt(target.x, target.y, target.z);

        // Set up controls
        controls.current = new OrbitControls(camera.current, renderer.current.domElement);
        controls.current.target.set(target.x, target.y, target.z);

        // Animation function
        const animate = () => {
          requestAnimationFrame(animate);

          // Render the scene
          if (scene.current && camera.current) {
              renderer.current?.render(scene.current, camera.current);
          }
          controls.current?.update();
        };

        animate()
    }, [/* no dependencies so this only runs on mount */]);


    renderer.current?.setSize(renderWidth, renderHeight);

    return (
        <div ref={divRef} />
    );
}
