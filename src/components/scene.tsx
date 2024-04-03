import { useEffect, useRef } from "react";

import { PointCanvas } from "@/lib/PointCanvas";
import { LoadingIndicator } from "@czi-sds/components";
import { Box } from "@mui/material";

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
        divCurrent?.insertBefore(renderer.domElement, divCurrent.firstChild);

        // start animating - this keeps the scene rendering when controls change, etc.
        canvas.current.animate();

        const handleWindowResize = () => {
            if (!divCurrent) return;
            const renderWidth = divCurrent.clientWidth;
            const renderHeight = divCurrent.clientHeight;
            canvas.current?.setSize(renderWidth, renderHeight);
        };
        window.addEventListener("resize", handleWindowResize);
        handleWindowResize();

        return () => {
            renderer.domElement.remove();
            canvas.current?.dispose();
        };
    }, []); // dependency array must be empty to run only on mount!

    const loading = props.loading ? "visible" : "hidden";

    return (
        <Box
            ref={divRef}
            sx={{
                display: "flex",
                flexDirection: "column",
                flexGrow: 1,
                width: "100%",
                height: "100%",
                overflow: "hidden",
            }}
        >
            <Box sx={{ margin: "-5% auto", visibility: loading, zIndex: 1000, opacity: "70%" }}>
                <LoadingIndicator sdsStyle="tag" />
            </Box>
        </Box>
    );
}
