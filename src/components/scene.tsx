import { useEffect, useRef } from "react";

import { PointCanvas } from "@/lib/PointCanvas";
import { LoadingIndicator } from "@czi-sds/components";

interface SceneProps {
    initialCameraPosition?: THREE.Vector3;
    initialCameraTarget?: THREE.Vector3;
    canvas: React.MutableRefObject<PointCanvas | null>;
    loading: boolean;
}

export default function Scene(props: SceneProps) {
    const canvas = props.canvas;

    // Use references here for two things:
    // * manage objects that should never change, even when the component re-renders
    // * avoid triggering re-renders when these *do* change
    const divRef: React.RefObject<HTMLDivElement> = useRef(null);
    const renderWidth = divRef.current?.clientWidth || 800;
    const renderHeight = divRef.current?.clientHeight || 600;

    // this useEffect is intended to make this part run only on mount
    // this requires keeping the dependency array empty
    useEffect(() => {
        // initialize the canvas
        canvas.current = new PointCanvas(renderWidth, renderHeight);
        canvas.current!.setCameraProperties(props.initialCameraPosition, props.initialCameraTarget);

        // append renderer canvas
        const divCurrent = divRef.current;
        const renderer = canvas.current!.renderer;
        divCurrent?.appendChild(renderer.domElement);

        // start animating - this keeps the scene rendering when controls change, etc.
        canvas.current.animate();

        const handleWindowResize = () => {
            if (!divCurrent) return;
            console.log("resize canvas", divCurrent.offsetWidth, divCurrent.offsetHeight);
            const renderWidth = divCurrent.offsetWidth;
            const renderHeight = 0.9 * divCurrent.offsetHeight;
            canvas.current?.setSize(renderWidth, renderHeight);
        };
        window.addEventListener("resize", handleWindowResize);
        handleWindowResize();

        return () => {
            window.removeEventListener("resize", handleWindowResize);
            renderer.domElement.remove();
            canvas.current?.dispose();
        };
    }, []); // dependency array must be empty to run only on mount!

    const loading = props.loading ? "visible" : "hidden";

    return (
        <div ref={divRef} style={{ width: "100%", height: "100%" }}>
            <div style={{ position: "relative", top: "85%", left: "50%", visibility: loading }}>
                <LoadingIndicator sdsStyle="tag" />
            </div>
        </div>
    );
}
