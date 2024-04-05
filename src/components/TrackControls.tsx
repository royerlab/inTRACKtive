import { TrackManager } from "@/lib/TrackManager";
import { Button, InputSlider } from "@czi-sds/components";
import { Stack } from "@mui/material";

interface TrackControlsProps {
    trackManager: TrackManager | null;
    trackHighlightLength: number;
    setTrackHighlightLength: (trackHighlightLength: number) => void;
    clearTracks: () => void;
}

export default function TrackControls(props: TrackControlsProps) {
    const numTimes = props.trackManager?.points.shape[0] ?? 0;

    return (
        <Stack spacing={4}>
            <label htmlFor="track-highlight-length-slider">
                <h5>Track Highlights Length</h5>
            </label>
            <InputSlider
                id="track-highlight-length-slider"
                aria-labelledby="input-slider-track-highlight-length"
                disabled={!props.trackManager}
                min={0}
                max={numTimes * 2}
                valueLabelDisplay="on"
                valueLabelFormat={(value) => `${value} frames`}
                onChange={(_, value) => {
                    props.setTrackHighlightLength(value as number);
                }}
                value={props.trackHighlightLength}
            />
            <Stack direction="row" spacing={4}>
                <Button sdsStyle="minimal" sdsType="primary" disabled={!props.trackManager} onClick={props.clearTracks}>
                    Clear Tracks
                </Button>
            </Stack>
        </Stack>
    );
}
