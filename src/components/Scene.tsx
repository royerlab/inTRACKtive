import { forwardRef } from "react";

import { LoadingIndicator } from "@czi-sds/components";
import { Box } from "@mui/material";

interface SceneProps {
    isLoading: boolean;
}

const Scene = forwardRef(function SceneRender(props: SceneProps, ref: React.Ref<HTMLCanvasElement>) {
    const isLoading = props.isLoading ? "visible" : "hidden";
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                flexGrow: 1,
                width: "100%",
                height: "100%",
            }}
        >
            <Box sx={{ margin: "-3rem auto", visibility: isLoading, zIndex: 1000, opacity: "70%" }}>
                <LoadingIndicator sdsStyle="tag" />
            </Box>
            <canvas
                ref={ref}
                tabIndex={0}
                style={{
                    outline: "none",
                    touchAction: "none",
                }}
                onTouchStart={(e) => {
                    e.currentTarget.focus();
                }}
            />
        </Box>
    );
});

export default Scene;
