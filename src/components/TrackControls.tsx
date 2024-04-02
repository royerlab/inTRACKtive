import { TrackManager } from "@/lib/TrackManager";
import { Button, InputSlider, InputText } from "@czi-sds/components";
import { Stack } from "@mui/material";

interface TrackControlsProps {
    dataUrl: string;
    initialDataUrl: string;
    trackManager: TrackManager | null;
    trackHighlightLength: number;
    setDataUrl: (dataUrl: string) => void;
    setTrackHighlightLength: (trackHighlightLength: number) => void;
    copyShareableUrlToClipboard: () => void;
    clearTracks: () => void;
}

export default function TrackControls(props: TrackControlsProps) {
    const numTimes = props.trackManager?.points.shape[0] ?? 0;
    const trackLengthPct = numTimes ? (props.trackHighlightLength / 2 / numTimes) * 100 : 0;

    return (
        <Stack spacing={4} sx={{ margin: "2em" }}>
            <InputText
                id="url-input"
                label="Zarr URL"
                placeholder={props.initialDataUrl}
                defaultValue={props.initialDataUrl}
                onChange={(e) => props.setDataUrl(e.target.value)}
                fullWidth={true}
                intent={props.trackManager ? "default" : "error"}
            />

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
                <Button disabled={!props.trackManager} onClick={props.clearTracks}>
                    Clear Tracks
                </Button>
            </Stack>
        </Stack>
    );
}
