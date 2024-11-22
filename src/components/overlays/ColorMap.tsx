import { Box } from "@mui/material";
// import variables from the sds-components library
import "@czi-sds/components/dist/variables.css";
import { highlightLUT } from "@/lib/three/TrackMaterial";
import { Option } from "@/components/leftSidebar/DynamicDropdown";
import config from "../../../CONFIG.ts";
const colormapTracks = config.settings.colormap_tracks || "viridis-inferno";
const colormapColorbyCategorical = config.settings.colormap_colorby_categorical;
const colormapColorbyContinuous = config.settings.colormap_colorby_continuous;

export const ColorMapTracks = () => {
    highlightLUT.setColorMap(colormapTracks);
    const colors = Array.from({ length: 129 }, (_, i) => `#${highlightLUT.getColor(i / 128).getHexString()}`);
    const gradient = `linear-gradient(to top, ${colors.join(", ")})`;

    return (
        <Box
            sx={{
                position: "absolute",
                bottom: "0.5rem",
                right: "0.5rem",
                width: "4.5rem",
                height: "8.5rem",
                backgroundColor: "rgba(255, 255, 255, 0.6)",
                zIndex: 100,
                borderRadius: "var(--sds-corner-m)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                fontSize: "1rem",
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
                    width: "var(--sds-space-m)",
                    background: gradient,
                }}
            />
            <Box>Past</Box>
        </Box>
    );
};

interface ColormapCellsProps {
    colorByEvent: Option; // Currently timestamp is a frame number, but it could be the actual timestamp
}

export const ColorMapCells = (props: ColormapCellsProps) => {
    let colormapString;
    let numSteps = 129;
    if (props.colorByEvent.type === "categorical") {
        colormapString = colormapColorbyCategorical;
        numSteps = props.colorByEvent.numCategorical || 129;
    } else if (props.colorByEvent.type === "continuous") {
        colormapString = colormapColorbyContinuous;
    } else {
        colormapString = "magma";
    }

    highlightLUT.setColorMap(colormapString);

    // const colors = Array.from({ length: 129 }, (_, i) => `#${highlightLUT.getColor(i / 128).getHexString()}`);
    // const gradient = `linear-gradient(to top, ${colors.join(", ")})`;

    const colors = Array.from(
        { length: numSteps },
        (_, i) => `#${highlightLUT.getColor(i / (numSteps - 1)).getHexString()}`,
    );

    // Construct a discrete gradient
    const gradientStops = colors.map((color, index) => {
        const start = (index / numSteps) * 100;
        const end = ((index + 1) / numSteps) * 100;
        return `${color} ${start}%, ${color} ${end}%`;
    });
    const gradient = `linear-gradient(to top, ${gradientStops.join(", ")})`;

    return (
        <Box
            sx={{
                position: "absolute",
                bottom: "0.5rem",
                right: "5.5rem",
                width: "4.5rem",
                height: "8.5rem",
                backgroundColor: "rgba(255, 255, 255, 0.6)",
                zIndex: 100,
                borderRadius: "var(--sds-corner-m)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                fontSize: "1rem",
                letterSpacing: "var(--sds-font-body-xxxs-400-letter-spacing)",
            }}
        >
            <Box>Attribute</Box>
            <Box
                sx={{
                    height: "4rem",
                    borderRadius: "var(--sds-corner-l)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    flexGrow: 1,
                    width: "var(--sds-space-m)",
                    background: gradient,
                }}
            />
            <Box>.</Box>
        </Box>
    );
};
