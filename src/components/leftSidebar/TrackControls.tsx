import { TrackManager, Option, numberOfValuesPerPoint } from "@/lib/TrackManager";
import { TRACK_COLORMAP_NAMES, CELL_COLORMAP_NAMES, colormaps } from "@/lib/Colormaps";
import { Dropdown, InputSlider, InputToggle } from "@czi-sds/components";
import {
    Autocomplete,
    Box,
    createFilterOptions,
    MenuItem,
    Select,
    SelectChangeEvent,
    Stack,
    TextField,
} from "@mui/material";
import { ControlLabel, FontS } from "@/components/Styled";
import config from "../../../CONFIG.ts";

function buildGradient(colormapName: string): string {
    colormaps.setColorMap(colormapName);
    const colors = Array.from({ length: 32 }, (_, i) => `#${colormaps.getColor(i / 31).getHexString()}`);
    return `linear-gradient(to right, ${colors.join(", ")})`;
}

interface ColormapSelectProps {
    value: string;
    options: string[];
    onChange: (name: string) => void;
}

function ColormapSelect({ value, options, onChange }: ColormapSelectProps) {
    return (
        <Select
            value={value}
            size="small"
            onChange={(e: SelectChangeEvent) => onChange(e.target.value)}
            renderValue={(selected) => (
                <Box sx={{ background: buildGradient(selected), height: "1em", borderRadius: "3px" }} />
            )}
            sx={{ width: "100%" }}
        >
            {options.map((name) => (
                <MenuItem key={name} value={name}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "0.6em", width: "100%" }}>
                        <Box
                            sx={{
                                background: buildGradient(name),
                                width: "4em",
                                height: "0.9em",
                                borderRadius: "3px",
                                flexShrink: 0,
                            }}
                        />
                        <FontS>{name}</FontS>
                    </Box>
                </MenuItem>
            ))}
        </Select>
    );
}

const allowColorByAttribute = config.permission.allowColorByAttribute;
const rgbFilterOptions = createFilterOptions<Option>({ limit: 100 });
const channelHues: Record<string, { background: string; border: string }> = {
    Red: { background: "rgba(255, 80, 80, 0.12)", border: "rgba(210, 45, 45, 0.55)" },
    Green: { background: "rgba(60, 180, 90, 0.12)", border: "rgba(35, 135, 65, 0.55)" },
    Blue: { background: "rgba(70, 130, 255, 0.12)", border: "rgba(40, 95, 210, 0.55)" },
};

interface RgbFeatureSelectProps {
    channel: string;
    options: Option[];
    value: Option | null;
    onChange: (value: Option | null) => void;
}

export function RgbFeatureSelect({ channel, options, value, onChange }: RgbFeatureSelectProps) {
    const hue = channelHues[channel];
    return (
        <Autocomplete
            size="small"
            sx={{
                "backgroundColor": hue?.background,
                "borderRadius": "4px",
                "& .MuiOutlinedInput-notchedOutline": { borderColor: hue?.border },
                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: hue?.border },
            }}
            options={options}
            value={value}
            filterOptions={rgbFilterOptions}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, selected) => option.label === selected.label}
            onChange={(_, option) => onChange(option)}
            renderInput={(params) => (
                <TextField {...params} label={`${channel} feature`} placeholder="Type to filter genes" />
            )}
        />
    );
}

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
    trackWidth: number;
    setTrackWidth: (ratio: number) => void;
    axesVisible: boolean;
    toggleAxesVisible: () => void;
    colorBy: boolean;
    toggleColorBy: (colorBy: boolean) => void;
    colorByEvent: Option;
    changeColorBy: (value: Option) => void;
    multiColorBy: boolean;
    toggleMultiColorBy: (enabled: boolean) => void;
    colorByEvents: Array<Option | null>;
    changeMultiColorBy: (values: Array<Option | null>) => void;
    colormapTracks: string;
    setColormapTracks: (name: string) => void;
    colormapCells: string;
    setColormapCells: (name: string) => void;
}

export default function TrackControls(props: TrackControlsProps) {
    const numTimes = props.trackManager?.points.shape[0] ?? 0;
    const dropDownOptions = props.trackManager?.attributeOptions ?? [];
    const continuousOptions = dropDownOptions.filter((option) => option.type === "continuous");
    const channelNames = ["Red", "Green", "Blue"];

    return (
        <Stack spacing={"1.1em"}>
            <ControlLabel>Visualization options</ControlLabel>

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

            {/* Track highlights colormap dropdown */}
            {props.hasTracks && props.showTrackHighlights && (
                <ColormapSelect
                    value={props.colormapTracks}
                    options={TRACK_COLORMAP_NAMES}
                    onChange={props.setColormapTracks}
                />
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

            {/* ColorBy toggle */}
            {dropDownOptions.length > 1 && allowColorByAttribute && (
                <Box display="flex" flexDirection="row" alignItems="center" justifyContent="space-between">
                    <label htmlFor="color-cells">
                        <FontS>Color cells</FontS>
                    </label>
                    <Box>
                        <InputToggle
                            id="color-cells"
                            checked={props.colorBy}
                            onChange={(e) => {
                                props.toggleColorBy((e.target as HTMLInputElement).checked);
                            }}
                        />
                    </Box>
                </Box>
            )}

            {/* RGB multi-feature mode */}
            {props.colorBy && continuousOptions.length > 1 && (
                <Box display="flex" flexDirection="row" alignItems="center" justifyContent="space-between">
                    <label htmlFor="multi-color-cells">
                        <FontS>RGB features</FontS>
                    </label>
                    <InputToggle
                        id="multi-color-cells"
                        checked={props.multiColorBy}
                        onChange={(e) => props.toggleMultiColorBy((e.target as HTMLInputElement).checked)}
                    />
                </Box>
            )}

            {props.colorBy && props.multiColorBy && (
                <Stack spacing="0.8em">
                    {channelNames.map((channel, channelIndex) => {
                        const value = props.colorByEvents[channelIndex] ?? null;
                        const selectedLabels = new Set(
                            props.colorByEvents
                                .filter((option): option is Option => option !== null)
                                .map((option) => option.label),
                        );
                        const options = continuousOptions.filter(
                            (option) => option.label === value?.label || !selectedLabels.has(option.label),
                        );
                        return (
                            <RgbFeatureSelect
                                key={channel}
                                channel={channel}
                                options={options}
                                value={value}
                                onChange={(option) => {
                                    const selections = Array.from(
                                        { length: 3 },
                                        (_, index) => props.colorByEvents[index] ?? null,
                                    );
                                    selections[channelIndex] = option;
                                    props.changeMultiColorBy(selections);
                                }}
                            />
                        );
                    })}
                </Stack>
            )}

            {/* Color cells by dropdown */}
            {props.colorBy && !props.multiColorBy && (
                <div>
                    <Dropdown
                        label={`Color: ${props.colorByEvent.name}`}
                        options={dropDownOptions}
                        value={props.colorByEvent}
                        onChange={(_, value) => {
                            console.debug("Dropdown::onChange", value);
                            // TODO: I don't know if these values are actually possible.
                            // If they are, we can either error/warn and/or use the default
                            // value instead.
                            if (value === null) return;
                            if (typeof value === "string") return;
                            if (value instanceof Array) return;
                            props.changeColorBy(value);
                        }}
                    ></Dropdown>
                </div>
            )}

            {/* Cell colormap dropdown */}
            {props.colorBy &&
                !props.multiColorBy &&
                (props.colorByEvent.type === "categorical" || props.colorByEvent.type === "continuous") && (
                    <ColormapSelect
                        value={props.colormapCells}
                        options={CELL_COLORMAP_NAMES}
                        onChange={props.setColormapCells}
                    />
                )}

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
            <label htmlFor="points-brightness-slider" style={{ marginTop: "1.0em" }}>
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

            {/* Track width slider */}
            {props.hasTracks && (props.showTracks || props.showTrackHighlights) && (
                <label htmlFor="track-width-slider">
                    <FontS>Track Width</FontS>
                </label>
            )}
            {props.hasTracks && (props.showTracks || props.showTrackHighlights) && (
                <InputSlider
                    id="track-width-slider"
                    aria-labelledby="input-slider-track-width"
                    disabled={!props.trackManager}
                    min={0.1}
                    max={2}
                    step={0.1}
                    valueLabelDisplay="on"
                    valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                    onChange={(_, value) => {
                        props.setTrackWidth(value as number);
                    }}
                    value={props.trackWidth}
                />
            )}

            {/* Track highlight length slider */}
            {props.hasTracks && props.showTrackHighlights && (
                <label htmlFor="track-highlight-length-slider" style={{ marginTop: "0.0em" }}>
                    <FontS>Track Highlight Length</FontS>
                </label>
            )}
            {props.hasTracks && props.showTrackHighlights && (
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
