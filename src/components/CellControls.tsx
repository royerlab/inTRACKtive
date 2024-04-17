import { Box, Stack } from "@mui/material";

import { TrackManager } from "@/lib/TrackManager";
import { FontS, SmallCapsButton, ControlLabel } from "@/components/Styled";

interface CellControlsProps {
    numCells?: number;
    trackManager: TrackManager | null;
    clearTracks: () => void;
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
                    <strong>{props.numCells ?? 0}</strong> cells selected
                </FontS>
            </Stack>
        </Stack>
    );
}
