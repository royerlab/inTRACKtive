import { Stack } from "@mui/material";

import { InputSlider, InputToggle } from "@czi-sds/components";

interface PlaybackControlsProps {
    enabled: boolean;
    autoRotate: boolean;
    playing: boolean;
    curTime: number;
    numTimes: number;
    setAutoRotate: (isRotating: boolean) => void;
    setPlaying: (isPlaying: boolean) => void;
    setCurTime: (curTime: number) => void;
}

export default function PlaybackControls(props: PlaybackControlsProps) {
    return (
        <Stack direction="row" spacing={8} sx={{ margin: "2em" }}>
            <label htmlFor="auto-rotate-toggle">Auto Rotate</label>
            <InputToggle
                checked={props.autoRotate}
                disabled={!props.enabled}
                onChange={(e) => {
                    props.setAutoRotate((e.target as HTMLInputElement).checked);
                }}
            />
            <label htmlFor="playback-toggle">Playback</label>
            <InputToggle
                checked={props.playing}
                disabled={!props.enabled}
                onChange={(e) => {
                    props.setPlaying((e.target as HTMLInputElement).checked);
                }}
            />
            <InputSlider
                id="time-frame-slider"
                aria-labelledby="input-slider-time-frame"
                disabled={!props.enabled}
                min={0}
                max={props.numTimes - 1}
                valueLabelDisplay="on"
                onChange={(_, value) => props.setCurTime(value as number)}
                value={props.curTime}
            />
        </Stack>
    );
}
