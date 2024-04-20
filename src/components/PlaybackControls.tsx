import { Box } from "@mui/material";
import { ButtonIcon, InputSlider } from "@czi-sds/components";

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
        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "2em" }}>
            <ButtonIcon
                icon="Play"
                sdsSize="large"
                sdsType="primary"
                on={props.playing}
                disabled={!props.enabled}
                onClick={() => props.setPlaying(!props.playing)}
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
                sx={{ alignSelf: "flex-end" }}
            />
            {/* TODO: add control button groups - perhaps a separate component */}
            <ButtonIcon
                icon="DNA"
                sdsSize="large"
                sdsType="primary"
                on={props.autoRotate}
                disabled={!props.enabled}
                onClick={() => props.setAutoRotate(!props.autoRotate)}
            />
        </Box>
    );
}
