import { Box } from "@mui/material";
// import variables from the sds-components library
import "@czi-sds/components/dist/variables.css";
import { highlightLUT } from "@/lib/three/TrackMaterial";

export const ColorMap = () => {
    const colors = Array.from({ length: 129 }, (_, i) => `#${highlightLUT.getColor(i / 128).getHexString()}`);
    const gradient = `linear-gradient(to top, ${colors.join(", ")})`;

    return (
        <Box
            sx={{
                position: "absolute",
                bottom: "0.5rem",
                right: "0.5rem",
                width: "2.5rem",
                height: "6.5rem",
                backgroundColor: "rgba(255, 255, 255, 0.6)",
                zIndex: 100,
                borderRadius: "var(--sds-corner-m)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                fontSize: "0.6875rem",
                letterSpacing: "var(--sds-font-body-xxxs-400-letter-spacing)",
            }}
        >
            <Box>Future</Box>
            <Box
                sx={{
                    height: "4rem",
                    borderRadius: "var(--sds-corner-l)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    flexGrow: 1,
                    width: "var(--sds-space-xxs)",
                    background: gradient,
                }}
            />
            <Box>Past</Box>
        </Box>
    );
};
