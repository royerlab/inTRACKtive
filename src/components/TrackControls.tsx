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
    const trackLengthPct = numTimes ? (props.trackHighlightLength / 2 / numTimes) * 100 : 0;

    return (
        <Stack spacing={4} sx={{ margin: "2em" }}>
            <label htmlFor="track-highlight-length-slider">
                <h5>Track Highlights Length</h5>
            </label>
            <InputSlider
                id="track-highlight-length-slider"
                aria-labelledby="input-slider-track-highlight-length"
                disabled={!props.trackManager}
                min={0}
                max={100}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}%`}
                onChange={(_, value) => {
                    if (!props.trackManager) return;
                    const v = ((value as number) / 100) * 2 * numTimes;
                    props.setTrackHighlightLength(v);
                }}
                value={Math.round(trackLengthPct)}
            />
            <Stack direction="row" spacing={4}>
                <Button sdsStyle="minimal" sdsType="primary" disabled={!props.trackManager} onClick={props.clearTracks}>
                    Clear Tracks
                </Button>
            </Stack>
        </Stack>
    );
}
