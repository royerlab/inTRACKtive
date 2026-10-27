import { TrackManager, Option } from "@/lib/TrackManager";
import { TRACK_COLORMAP_NAMES, CELL_COLORMAP_NAMES, colormaps } from "@/lib/Colormaps";
import { Dropdown, InputSlider, InputToggle } from "@czi-sds/components";
import { Box, MenuItem, Select, SelectChangeEvent, Stack } from "@mui/material";
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

// Sentinel option representing "no second tissue" in the second-tissue dropdown.
// Module-scoped so its reference identity is stable across renders (the SDS Dropdown
// compares options by reference).
const NONE_OPTION: Option = {
    name: "None",
    label: -1,
    type: "default",
    action: "default",
    numCategorical: undefined,
};

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
    colorBySecondEvent: Option | null;
    changeSecondColorBy: (value: Option | null) => void;
    colormapTracks: string;
    setColormapTracks: (name: string) => void;
    colormapCells: string;
    setColormapCells: (name: string) => void;
}

export default function TrackControls(props: TrackControlsProps) {
    const numTimes = props.trackManager?.points.shape[0] ?? 0;
    const dropDownOptions = props.trackManager?.attributeOptions ?? [];
    // Options for the second tissue: only other hex-binary attributes, plus a "None" opt-out.
    const secondHexOptions = [
        NONE_OPTION,
        ...dropDownOptions.filter((o) => o.type === "hex-binary" && o.label !== props.colorByEvent.label),
    ];

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
                            id="show-track-highlights"
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
                <label htmlFor="show-axes">
                    <FontS>Axes</FontS>
                </label>
                <Box>
                    <InputToggle
                        id="show-axes"
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

            {/* Color cells by dropdown */}
            {props.colorBy == true && (
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

            {/* Second tissue dropdown (only for hex-binary, when another hex-binary attribute exists) */}
            {props.colorBy && props.colorByEvent.type === "hex-binary" && secondHexOptions.length > 1 && (
                <div>
                    <Dropdown
                        label={`Second tissue: ${props.colorBySecondEvent?.name ?? "None"}`}
                        options={secondHexOptions}
                        value={props.colorBySecondEvent ?? NONE_OPTION}
                        onChange={(_, value) => {
                            console.debug("Second tissue Dropdown::onChange", value);
                            if (value === null) return;
                            if (typeof value === "string") return;
                            if (value instanceof Array) return;
                            props.changeSecondColorBy(value === NONE_OPTION ? null : value);
                        }}
                    ></Dropdown>
                </div>
            )}

            {/* Cell colormap dropdown */}
            {props.colorBy &&
                (props.colorByEvent.type === "categorical" || props.colorByEvent.type === "continuous") && (
                    <ColormapSelect
                        value={props.colormapCells}
                        options={CELL_COLORMAP_NAMES}
                        onChange={props.setColormapCells}
                    />
                )}

            {/* Cell size slider */}
            {props.trackManager?.numberOfValuesPerPoint !== 4 && (
                <>
                    <label htmlFor="points-sizes-slider">
                        <FontS id="input-slider-points-sizes-slider">Cell Size</FontS>
                    </label>
                    <InputSlider
                        style={{ marginTop: "-0.3em" }}
                        id="points-sizes-slider"
                        aria-labelledby="input-slider-points-sizes-slider"
                        disabled={props.trackManager?.numberOfValuesPerPoint === 4}
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
