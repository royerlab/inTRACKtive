import { forwardRef } from "react";

import { LoadingIndicator } from "@czi-sds/components";
import { Box } from "@mui/material";

interface SceneProps {
    loading: boolean;
    initialCameraPosition?: THREE.Vector3;
    initialCameraTarget?: THREE.Vector3;
}

const Scene = forwardRef(function SceneRender(props: SceneProps, ref: React.Ref<HTMLDivElement>) {
    const loading = props.loading ? "visible" : "hidden";
    return (
        <Box
            ref={ref}
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
});

export default Scene;
