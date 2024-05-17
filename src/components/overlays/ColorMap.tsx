import { Box } from "@mui/material";
// import variables from the sds-components library
import "@czi-sds/components/dist/variables.css";
import { highlightLUT } from "@/lib/three/TrackMaterial";

export const ColorMap = () => {
    const gradientBoxes = [];
    for (let i = 0; i < 128; i++) {
        const color = highlightLUT.getColor(i / 128);
        gradientBoxes.push(
            <Box
                key={i}
                sx={{
                    width: "var(--sds-space-xxs)",
                    backgroundColor: `rgb(${color.r * 255}, ${color.g * 255}, ${color.b * 255})`,
                    flexGrow: 1,
                }}
            />,
        );
    }

    return (
        <Box
            sx={{
                position: "absolute",
                bottom: "3.75rem",
                right: "0.5rem",
                width: "2.5rem",
                height: "6.5rem",
                backgroundColor: "rgba(255, 255, 255, 0.5)",
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
                }}
            >
                {gradientBoxes}
            </Box>
            <Box>Past</Box>
        </Box>
    );
};
