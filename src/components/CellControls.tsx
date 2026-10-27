import { Box, Stack, Tooltip } from "@mui/material";
import { InputSlider, SegmentedControl, SingleButtonDefinition, Button } from "@czi-sds/components";
import { FontS, SmallCapsButton, ControlLabel } from "@/components/Styled";
import { PointSelectionMode } from "@/lib/PointSelector";
import { TrackManager, Option, numberOfDefaultColorByOptions } from "@/lib/TrackManager";
import { DownloadButton } from "./DownloadButton";
import deviceState from "@/lib/DeviceState";

interface CellControlsProps {
    clearTracks: () => void;
    getTrackDownloadData: () => string[][];
    numSelectedCells?: number;
    numSelectedTracks?: number;
    trackManager: TrackManager | null;
    selectionMode: PointSelectionMode | null;
    setSelectionMode: (value: PointSelectionMode) => void;
    detectedDevice: typeof deviceState;
    MobileSelectCells: () => void;
    setSelectorScale: (value: number) => void;
    selectorScale: number;
    colorBy: boolean;
    colorByEvent: Option;
    colorBySecondEvent: Option | null;
    onSelectBinaryValue: (ids: Set<number>) => void;
    onLoadTissueTracks: () => void;
}

export default function CellControls(props: CellControlsProps) {
    const buttonDefinition: SingleButtonDefinition[] = [
        {
            icon: "Cube",
            tooltipText: "Box",
            value: PointSelectionMode.BOX,
            disabled: props.detectedDevice.current.isTablet,
        },
        {
            icon: "Starburst",
            tooltipText: "Sphere",
            value: PointSelectionMode.SPHERICAL_CURSOR,
            disabled: props.detectedDevice.current.isTablet,
        },
        { icon: "Globe", tooltipText: "Adjustable sphere", value: PointSelectionMode.SPHERE },
    ];

    const attributeIndex = props.colorByEvent.label - numberOfDefaultColorByOptions;

    const handleBinarySelection = () => {
        if (!props.trackManager) return;
        const pointIds = props.trackManager.annotPointIds?.[attributeIndex];
        if (!pointIds || pointIds.length === 0) return;
        props.onSelectBinaryValue(new Set(pointIds));
    };

    return (
        <Stack spacing="1em">
            <Box display="flex" flexDirection="row" alignItems="center" justifyContent="space-between">
                <ControlLabel>Selected Cells</ControlLabel>
                <SmallCapsButton disabled={!props.trackManager} onClick={props.clearTracks}>
                    Clear
                </SmallCapsButton>
            </Box>
            <FontS>
                <strong>{props.numSelectedCells ?? 0}</strong> cells selected
            </FontS>
            <FontS>
                <strong>{props.numSelectedTracks ?? 0}</strong> tracks loaded
            </FontS>
            {!!props.numSelectedCells && <DownloadButton getDownloadData={props.getTrackDownloadData} />}

            {props.trackManager &&
                props.colorBy &&
                props.colorByEvent.type === "hex-binary" &&
                (props.numSelectedCells ?? 0) == 0 &&
                (props.numSelectedTracks ?? 0) == 0 && (
                    <Tooltip
                        title={
                            props.colorBySecondEvent
                                ? "Set the second tissue to None to load tracks (track view shows one tissue at a time)"
                                : !props.trackManager.annotPointIds
                                  ? "Run add_annotations.py on this zarr to enable this feature"
                                  : ""
                        }
                    >
                        <span>
                            <Stack spacing="0.5em">
                                <Button
                                    sdsStyle="square"
                                    sdsType="primary"
                                    onClick={props.onLoadTissueTracks}
                                    disabled={!props.trackManager.annotPointIds || !!props.colorBySecondEvent}
                                >
                                    Load tissue tracks
                                </Button>
                                <Button
                                    sdsStyle="square"
                                    sdsType="secondary"
                                    onClick={handleBinarySelection}
                                    disabled={!props.trackManager.annotPointIds || !!props.colorBySecondEvent}
                                >
                                    Load full lineage
                                </Button>
                            </Stack>
                        </span>
                    </Tooltip>
                )}

            {/* Selection mode buttons */}
            <label htmlFor="selection-mode-control">
                <ControlLabel>Selection Mode</ControlLabel>
            </label>
            <Box display="flex" flexDirection="row" justifyContent="space-around">
                <SegmentedControl
                    id="selection-mode-control"
                    buttonDefinition={buttonDefinition}
                    onChange={(_e, v) => {
                        props.setSelectionMode(v);
                    }}
                    value={props.selectionMode}
                />
            </Box>
            {/* Select cells button */}
            <Box display="flex" justifyContent="center" alignItems="center">
                {(deviceState.current.isTablet || deviceState.current.isTabletWithKeyboard) &&
                    (props.selectionMode === PointSelectionMode.SPHERE ||
                        props.selectionMode === PointSelectionMode.SPHERICAL_CURSOR) && (
                        <Button sdsStyle="square" sdsType="primary" onClick={props.MobileSelectCells}>
                            Select cells
                        </Button>
                    )}
            </Box>
            {/* Selector radius slider */}
            {(props.selectionMode === PointSelectionMode.SPHERICAL_CURSOR ||
                props.selectionMode === PointSelectionMode.SPHERE) &&
                (deviceState.current.isTablet || deviceState.current.isTabletWithKeyboard) && (
                    <>
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                            <label htmlFor="selector-radius-slider">
                                <FontS id="input-selector-radius-slider">selector radius:</FontS>
                            </label>
                        </div>
                        <InputSlider
                            id="selector-radius-slider"
                            aria-labelledby="input-selector-radius-slider"
                            min={0.5}
                            max={5}
                            step={0.1}
                            // valueLabelDisplay="on"
                            valueLabelFormat={(value) => `${value}`}
                            onChange={(_, value) => {
                                props.setSelectorScale(value as number);
                            }}
                            value={props.selectorScale}
                        />
                    </>
                )}
        </Stack>
    );
}
