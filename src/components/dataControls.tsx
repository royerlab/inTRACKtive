import { TrackManager } from "@/lib/TrackManager";
import { Button, ButtonIcon, InputSlider, InputText } from "@czi-sds/components";
import { Stack } from "@mui/material";

interface DataControlsProps {
    dataUrl: string;
    initialDataUrl: string;
    trackManager: TrackManager | null;
    trackHighlightLength: number;
    setDataUrl: (dataUrl: string) => void;
    setTrackHighlightLength: (trackHighlightLength: number) => void;
    copyShareableUrlToClipboard: () => void;
    clearTracks: () => void;
}

export default function DataControls(props: DataControlsProps) {
    const numTimes = props.trackManager?.points.shape[0] ?? 0;
    const trackLengthPct = numTimes ? (props.trackHighlightLength / 2 / numTimes) * 100 : 0;

    console.log("trackLengthPct: %s", props.trackManager?.maxPointsPerTimepoint);
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
            <label htmlFor="track-highlight-length-slider">Track Highlight Length</label>
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
                <ButtonIcon
                    sdsIcon="share"
                    sdsSize="large"
                    sdsType="primary"
                    disabled={!props.trackManager}
                    onClick={props.copyShareableUrlToClipboard}
                />
            </Stack>
        </Stack>
    );
}
