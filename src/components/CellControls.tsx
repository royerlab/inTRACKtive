import { TrackManager } from "@/lib/TrackManager";
import { Button, fontBodyS, fontCapsXxs } from "@czi-sds/components";
import { Box, Stack } from "@mui/material";
import styled from "@emotion/styled";

interface CellControlsProps {
    numCells?: number;
    trackManager: TrackManager | null;
    clearTracks: () => void;
}

export default function CellControls(props: CellControlsProps) {
    return (
        <Stack spacing={4}>
            <Box display="flex" flexDirection="row" alignItems="center" justifyContent="space-between">
                <h5 style={{ margin: 0 }}>Selected Cells</h5>
                <SmallCapsButton disabled={!props.trackManager} onClick={props.clearTracks}>
                    Clear
                </SmallCapsButton>
            </Box>
            <FontS>
                <strong>{props.numCells ?? 0}</strong> cells selected
            </FontS>
        </Stack>
    );
}

const FontS = styled.p`
    ${fontBodyS}
    margin: 0;
`;

const SmallCapsButton = styled(Button)`
    ${fontCapsXxs}
    sdsStyle="minimal"
    sdsType="primary"
`;
