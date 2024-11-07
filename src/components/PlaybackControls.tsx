import { Box, Tooltip } from "@mui/material";
import { Button, InputSlider } from "@czi-sds/components";

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
        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "1em" }}>
            <Button
                icon="Play"
                sdsSize="large"
                sdsType={props.playing ? "primary" : "secondary"} // Use a different `sdsType` to change color upon toggle
                sdsStyle="icon"
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
            <Tooltip title="Auto-rotate">
                <Button
                    // startIcon={<Icon sdsIcon="DNA" sdsSize="xl" sdsType="button" />}
                    icon="DNA"
                    sdsSize="large"
                    sdsType={props.autoRotate ? "primary" : "secondary"} // Use a different `sdsType` to change color upon toggle
                    sdsStyle="icon"
                    disabled={!props.enabled}
                    onClick={() => props.setAutoRotate(!props.autoRotate)}
                />
            </Tooltip>
        </Box>
    );
}
