import { TrackManager } from "@/lib/TrackManager";
import { InputSlider, InputToggle } from "@czi-sds/components";
import { Box, Stack } from "@mui/material";

import { ControlLabel } from "@/components/Styled";

interface TrackControlsProps {
    trackManager: TrackManager | null;
    trackHighlightLength: number;
    showTracks: boolean;
    setShowTracks: (showTracks: boolean) => void;
    showTrackHighlights: boolean;
    setShowTrackHighlights: (showTrackHighlights: boolean) => void;
    setTrackHighlightLength: (trackHighlightLength: number) => void;
}

export default function TrackControls(props: TrackControlsProps) {
    const numTimes = props.trackManager?.points.shape[0] ?? 0;

    return (
        <Stack spacing={"2em"}>
            <Box display="flex" flexDirection="row" alignItems="center" justifyContent="space-between">
                <label htmlFor="show-tracks">
                    <ControlLabel>Tracks</ControlLabel>
                </label>
                <InputToggle
                    id="show-tracks"
                    checked={props.showTracks}
                    onChange={(e) => {
                        props.setShowTracks((e.target as HTMLInputElement).checked);
                    }}
                />
            </Box>
            <Box display="flex" flexDirection="row" alignItems="center" justifyContent="space-between">
                <label htmlFor="show-track-highlights">
                    <ControlLabel>Track Highlights</ControlLabel>
                </label>
                <Box>
                    <InputToggle
                        id="show-tracks-highlights"
                        checked={props.showTrackHighlights}
                        onChange={(e) => {
                            props.setShowTrackHighlights((e.target as HTMLInputElement).checked);
                        }}
                    />
                </Box>
            </Box>
            <label htmlFor="track-highlight-length-slider">
                <ControlLabel>Track Highlight Length</ControlLabel>
            </label>
            <InputSlider
                id="track-highlight-length-slider"
                aria-labelledby="input-slider-track-highlight-length"
                disabled={!props.trackManager}
                min={0}
                max={numTimes}
                valueLabelDisplay="on"
                valueLabelFormat={(value) => `${Math.round(value)} frames`}
                onChange={(_, value) => {
                    props.setTrackHighlightLength(2 * (value as number));
                }}
                value={props.trackHighlightLength / 2}
            />
        </Stack>
    );
}