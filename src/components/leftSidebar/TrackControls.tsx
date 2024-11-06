import { TrackManager, numberOfValuesPerPoint } from "@/lib/TrackManager";
import { InputSlider, InputToggle } from "@czi-sds/components";
import { Box, Stack } from "@mui/material";
import DynamicDropdown from "./DynamicDropdown";
import { useDropdownOptions } from "./dropDownOptions";

import { ControlLabel, FontS } from "@/components/Styled";

interface TrackControlsProps {
    trackManager: TrackManager | null;
    trackHighlightLength: number;
    showTracks: boolean;
    setShowTracks: (showTracks: boolean) => void;
    showTrackHighlights: boolean;
    setShowTrackHighlights: (showTrackHighlights: boolean) => void;
    setTrackHighlightLength: (trackHighlightLength: number) => void;
    pointBrightness: number;
    setPointBrightness: (value: number) => void;
    pointSize: number;
    setPointSize: (value: number) => void;
    hasTracks: boolean;
    axesVisible: boolean;
    toggleAxesVisible: () => void;
    changeColorBy: (value: number) => void;
}

export default function TrackControls(props: TrackControlsProps) {
    const numTimes = props.trackManager?.points.shape[0] ?? 0;

    const { options } = useDropdownOptions();

    return (
        <Stack spacing={"1.1em"}>
            <ControlLabel>Visualization options</ControlLabel>

            <div>
                {/* Pass options and update function as props */}
                <DynamicDropdown options={options} onClick={props.changeColorBy} />
            </div>

            {/* Tracks toggle */}
            {props.hasTracks && (
                <Box display="flex" flexDirection="row" alignItems="center" justifyContent="space-between">
                    <label htmlFor="show-tracks">
                        <FontS>Tracks</FontS>
                    </label>
                    <InputToggle
                        id="show-tracks"
                        checked={props.showTracks}
                        onChange={(e) => {
                            props.setShowTracks((e.target as HTMLInputElement).checked);
                        }}
                    />
                </Box>
            )}

            {/* Track highlights toggle */}
            {props.hasTracks && (
                <Box display="flex" flexDirection="row" alignItems="center" justifyContent="space-between">
                    <label htmlFor="show-track-highlights">
                        <FontS>Track Highlights</FontS>
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
            )}

            {/* Axes toggle */}
            <Box display="flex" flexDirection="row" alignItems="center" justifyContent="space-between">
                <label htmlFor="show-track-highlights">
                    <FontS>Axes</FontS>
                </label>
                <Box>
                    <InputToggle
                        id="show-tracks-highlights"
                        checked={props.axesVisible}
                        onChange={() => {
                            props.toggleAxesVisible();
                        }}
                    />
                </Box>
            </Box>

            {/* Cell size slider */}
            {numberOfValuesPerPoint !== 4 && (
                <>
                    <label htmlFor="points-sizes-slider">
                        <FontS id="input-slider-points-sizes-slider">Cell Size</FontS>
                    </label>
                    <InputSlider
                        style={{ marginTop: "-0.3em" }}
                        id="points-sizes-slider"
                        aria-labelledby="input-slider-points-sizes-slider"
                        disabled={numberOfValuesPerPoint === 4}
                        min={0.05}
                        max={1}
                        step={0.01}
                        valueLabelDisplay="off"
                        valueLabelFormat={(value) => `${value}`}
                        onChange={(_, value) => {
                            props.setPointSize(value as number);
                        }}
                        value={props.pointSize}
                    />
                </>
            )}

            {/* Cell brightness slider */}
            <label htmlFor="points-brightness-slider" style={{ marginTop: "0.0em" }}>
                <FontS id="input-slider-points-brightness-slider">Cell Brightness</FontS>
            </label>
            <InputSlider
                style={{ marginTop: "1.5em" }}
                id="points-brightness-slider"
                aria-labelledby="input-slider-points-brightness-slider"
                // disabled={!props.numSelectedCells}
                min={0}
                max={100}
                valueLabelDisplay="on"
                valueLabelFormat={(value) => `${Math.floor(value)}%`}
                onChange={(_, value) => {
                    props.setPointBrightness((value as number) * 0.01);
                }}
                value={props.pointBrightness * 100}
            />

            {/* Track highlight length slider */}
            {props.hasTracks && (
                <label htmlFor="track-highlight-length-slider" style={{ marginTop: "0.0em" }}>
                    <FontS>Track Highlight Length</FontS>
                </label>
            )}
            {props.hasTracks && (
                <InputSlider
                    style={{ marginTop: "1.5em" }}
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
            )}
        </Stack>
    );
}
