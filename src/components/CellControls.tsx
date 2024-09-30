import { Box, Stack } from "@mui/material";
import { InputSlider, SegmentedControl, SingleButtonDefinition } from "@czi-sds/components";
import { FontS, SmallCapsButton, ControlLabel } from "@/components/Styled";

import { PointSelectionMode } from "@/lib/PointSelector";
import { TrackManager } from "@/lib/TrackManager";
import { DownloadButton } from "./DownloadButton";

interface CellControlsProps {
    clearTracks: () => void;
    getTrackDownloadData: () => string[][];
    numSelectedCells?: number;
    numSelectedTracks?: number;
    trackManager: TrackManager | null;
    pointBrightness: number;
    setPointBrightness: (value: number) => void;
    selectionMode: PointSelectionMode;
    setSelectionMode: (value: PointSelectionMode) => void;
    isMobile: boolean;
}

export default function CellControls(props: CellControlsProps) {
    const buttonDefinition: SingleButtonDefinition[] = [
        { icon: "Cube", tooltipText: "Box", value: PointSelectionMode.BOX },
        { icon: "Starburst", tooltipText: "Spherical cursor", value: PointSelectionMode.SPHERICAL_CURSOR },
        { icon: "Globe", tooltipText: "Sphere", value: PointSelectionMode.SPHERE },
    ];

    // Intercept onChange of selection buttons to prevent the first two buttons from being selected on mobile devices
    const handleSegmentedControlChange = (_e: React.MouseEvent<HTMLElement>, newValue: PointSelectionMode | null) => {
        // If isMobile is true and the selected value corresponds to the first or second button, do nothing
        if (
            props.isMobile &&
            (newValue === PointSelectionMode.BOX || newValue === PointSelectionMode.SPHERICAL_CURSOR)
        ) {
            window.alert("This selection mode is not available on mobile devices.");
            console.log("Mobile device detected, preventing selection of box or spherical cursor");
            return; // Prevent selection
        }
        props.setSelectionMode(newValue!); // Otherwise, update the selection mode
    };

    return (
        <Stack spacing="1em">
            <Box display="flex" flexDirection="row" alignItems="center" justifyContent="space-between">
                <ControlLabel>Selected Cells</ControlLabel>
                <SmallCapsButton disabled={!props.trackManager} onClick={props.clearTracks}>
                    Clear
                </SmallCapsButton>
            </Box>
            <FontS>
                <strong>{props.numSelectedCells ?? 0}</strong> cells selected
            </FontS>
            <FontS>
                <strong>{props.numSelectedTracks ?? 0}</strong> tracks loaded
            </FontS>
            {!!props.numSelectedCells && <DownloadButton getDownloadData={props.getTrackDownloadData} />}
            <label htmlFor="selection-mode-control">
                <ControlLabel>Selection Mode</ControlLabel>
            </label>
            <Box display="flex" flexDirection="row" justifyContent="space-around">
                <SegmentedControl
                    id="selection-mode-control"
                    buttonDefinition={buttonDefinition}
                    onChange={handleSegmentedControlChange}
                    // onChange={(_e, v) => {
                    //     props.setSelectionMode(v);
                    // }}
                    value={props.selectionMode}
                />
            </Box>
            <label htmlFor="points-brightness-slider">
                <ControlLabel id="input-slider-points-brightness-slider">Point Brightness</ControlLabel>
            </label>
            <InputSlider
                id="points-brightness-slider"
                aria-labelledby="input-slider-points-brightness-slider"
                disabled={!props.numSelectedCells}
                min={0}
                max={100}
                valueLabelDisplay="on"
                valueLabelFormat={(value) => `${Math.floor(value)}%`}
                onChange={(_, value) => {
                    props.setPointBrightness((value as number) * 0.01);
                }}
                value={props.pointBrightness * 100}
            />
        </Stack>
    );
}
