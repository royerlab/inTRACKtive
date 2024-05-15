import { Box, Stack } from "@mui/material";
import { InputSlider, SegmentedControl, SingleButtonDefinition } from "@czi-sds/components";
import { FontS, SmallCapsButton, ControlLabel } from "@/components/Styled";

import { TrackManager } from "@/lib/TrackManager";
import { PointCanvas } from "@/lib/PointCanvas";

interface CellControlsProps {
    canvas: PointCanvas | null;
    numSelectedCells?: number;
    setNumSelectedCells: (value: number) => void;
    trackManager: TrackManager | null;
    pointBrightness: number;
    setPointBrightness: (value: number) => void;
    selectionMode: string;
    setSelectionMode: (value: string) => void;
}

export default function CellControls(props: CellControlsProps) {
    const buttonDefinition: SingleButtonDefinition[] = [
        { icon: "Cube", tooltipText: "Box", value: "box" },
        { icon: "Starburst", tooltipText: "Spherical cursor", value: "spherical-cursor" },
        { icon: "Globe", tooltipText: "Sphere", value: "sphere" },
    ];

    return (
        <Stack spacing="1em">
            <Box display="flex" flexDirection="row" alignItems="center" justifyContent="space-between">
                <ControlLabel>Selected Cells</ControlLabel>
                <SmallCapsButton
                    disabled={!props.trackManager}
                    onClick={() => {
                        props.canvas?.removeAllTracks();
                        // reset component state
                        props.setNumSelectedCells(0);
                        props.setPointBrightness(1);
                    }}
                >
                    Clear
                </SmallCapsButton>
            </Box>
            <FontS>
                <strong>{props.numSelectedCells ?? 0}</strong> cells selected
            </FontS>
            <label htmlFor="selection-mode-control">
                <ControlLabel>Selection Mode</ControlLabel>
            </label>
            <Box display="flex" flexDirection="row" justifyContent="space-around">
                <SegmentedControl
                    id="selection-mode-control"
                    buttonDefinition={buttonDefinition}
                    onChange={(_e, v) => {
                        props.canvas?.setSelectionMode(v);
                        props.setSelectionMode(v);
                    }}
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
