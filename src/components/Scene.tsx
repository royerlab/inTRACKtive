import { useEffect, useRef } from "react";

import { PointCanvas } from "@/lib/PointCanvas";
import { LoadingIndicator } from "@czi-sds/components";
import { Box } from "@mui/material";
import { PointsCollection } from "@/lib/PointSelectionBox";

interface SceneProps {
    setCanvas: (canvas: PointCanvas) => void;
    loading: boolean;
    initialCameraPosition?: THREE.Vector3;
    initialCameraTarget?: THREE.Vector3;
    setSelectedPoints: (points: PointsCollection) => void;
}

export default function Scene(props: SceneProps) {
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
        const canvas = new PointCanvas(renderWidth, renderHeight, props.setSelectedPoints);
        canvas.setCameraProperties(props.initialCameraPosition, props.initialCameraTarget);

        // store the canvas in the parent component
        // TODO: move this hook to the parent component?
        props.setCanvas(canvas);

        // append renderer canvas
        const divCurrent = divRef.current;
        const renderer = canvas.renderer;
        divCurrent?.insertBefore(renderer.domElement, divCurrent.firstChild);

        // start animating - this keeps the scene rendering when controls change, etc.
        canvas.animate();

        const handleWindowResize = () => {
            if (!divCurrent) return;
            const renderWidth = divCurrent.clientWidth;
            const renderHeight = divCurrent.clientHeight;
            canvas.setSize(renderWidth, renderHeight);
        };
        window.addEventListener("resize", handleWindowResize);
        handleWindowResize();

        return () => {
            renderer.domElement.remove();
            canvas.dispose();
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
