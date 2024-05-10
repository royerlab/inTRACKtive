import { Box, Stack } from "@mui/material";

import { TrackManager } from "@/lib/TrackManager";
import { FontS, SmallCapsButton, ControlLabel } from "@/components/Styled";
import { InputSlider } from "@czi-sds/components";

interface CellControlsProps {
    clearTracks: () => void;
    backgroundPointBrightness: number;
    numSelectedCells?: number;
    trackManager: TrackManager | null;
    setBackgroundPointBrightness: (value: number) => void;
}

export default function CellControls(props: CellControlsProps) {
    return (
        <Stack spacing={"2em"}>
            <Stack>
                <Box display="flex" flexDirection="row" alignItems="center" justifyContent="space-between">
                    <ControlLabel>Selected Cells</ControlLabel>
                    <SmallCapsButton disabled={!props.trackManager} onClick={props.clearTracks}>
                        Clear
                    </SmallCapsButton>
                </Box>
                <FontS>
                    <strong>{props.numSelectedCells ?? 0}</strong> cells selected
                </FontS>
            </Stack>
            <label htmlFor="points-brightness-slider">
                <ControlLabel id="input-slider-points-brightness-slider">Background Point Brightness</ControlLabel>
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
                    props.setBackgroundPointBrightness((value as number) * 0.01);
                }}
                value={props.backgroundPointBrightness * 100}
            />
        </Stack>
    );
}
