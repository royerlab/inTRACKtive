import { Box, Tooltip } from "@mui/material";
import { Button, InputSlider, Icon } from "@czi-sds/components";

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
                startIcon={<Icon sdsIcon="Play" sdsSize="xl" sdsType="button" />}
                // sdsSize="large"
                sdsType="primary"
                sdsStyle="icon"
                // on={props.playing} //deprecated
                disabled={!props.enabled}
                onClick={() => props.setPlaying(!props.playing)}
                sx={{
                    color: props.playing ? "text.primary" : "primary.main",
                    // minWidth: "auto", // Removes default min-width
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
                sx={{ alignSelf: "flex-end" }}
            />
            <Tooltip title="Auto-rotate">
                <Button
                    startIcon={<Icon sdsIcon="DNA" sdsSize="xl" sdsType="button" />}
                    // sdsSize="large"
                    sdsType="primary"
                    sdsStyle="icon"
                    // on={props.autoRotate} //deprecated
                    disabled={!props.enabled}
                    onClick={() => props.setAutoRotate(!props.autoRotate)}
                    sx={{
                        color: props.autoRotate ? "text.primary" : "primary.main",
                        // minWidth: "auto", // Removes default min-width
                    }}
                />
            </Tooltip>
        </Box>
    );
}
