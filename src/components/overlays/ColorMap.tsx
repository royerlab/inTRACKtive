import { Box } from "@mui/material";
// import variables from the sds-components library
import "@czi-sds/components/dist/variables.css";
import { highlightLUT } from "@/lib/three/TrackMaterial";
import { Option } from "@/lib/TrackManager";

interface ColorMapTracksProps {
    colormapName: string;
}

export const ColorMapTracks = ({ colormapName }: ColorMapTracksProps) => {
    highlightLUT.setColorMap(colormapName);
    const colors = Array.from({ length: 129 }, (_, i) => `#${highlightLUT.getColor(i / 128).getHexString()}`);
    const gradient = `linear-gradient(to top, ${colors.join(", ")})`;

    return (
        <Box
            sx={{
                position: "absolute",
                bottom: "0.5rem",
                right: "0.5rem",
                width: "4.5rem",
                height: "9.5rem",
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
            <Box sx={{ fontWeight: "bold" }}>Tracks</Box> {/* First line bold */}
            <Box sx={{ fontWeight: 300 }}>Future</Box> {/* Second line lighter */}
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
            <Box sx={{ fontWeight: 300 }}>Past</Box> {/* Second line lighter */}
        </Box>
    );
};

interface ColormapCellsProps {
    colorByEvent: Option;
    colormapName: string;
}

export const ColorMapCells = (props: ColormapCellsProps) => {
    let numSteps = 129;
    if (props.colorByEvent.type === "categorical") {
        numSteps = props.colorByEvent.numCategorical || 129;
    }

    highlightLUT.setColorMap(props.colormapName);

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
                height: "9.5rem",
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
            <Box sx={{ fontWeight: "bold" }}>Cells</Box> {/* First line bold */}
            <Box sx={{ fontWeight: 300 }}>
                {props.colorByEvent.name.length > 8
                    ? props.colorByEvent.name.substring(0, 8) + "…"
                    : props.colorByEvent.name}
            </Box>{" "}
            {/* Second line lighter */}
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
            <Box sx={{ visibility: "hidden" }}>Placeholder</Box> {/* Invisible, keeps alignment */}
        </Box>
    );
};
