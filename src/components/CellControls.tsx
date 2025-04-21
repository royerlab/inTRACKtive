import { Box, Stack } from "@mui/material";
import { InputSlider, SegmentedControl, SingleButtonDefinition, Button } from "@czi-sds/components";
import { FontS, SmallCapsButton, ControlLabel } from "@/components/Styled";
import { PointSelectionMode } from "@/lib/PointSelector";
import { TrackManager, Option, numberOfDefaultColorByOptions } from "@/lib/TrackManager";
import { DownloadButton } from "./DownloadButton";
import deviceState from "@/lib/DeviceState";
import { usePointCanvas } from "@/hooks/usePointCanvas";

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
    onSelectBinaryValue: (indices: number[], ids: Set<number>) => void;
    dispatchCanvas: (action: any) => void;
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

    const handleBinarySelection = async () => {
        if (!props.trackManager) return;
                
        try {
            // Disable track highlights and set point brightness to 1.0 before selecting cells
            props.dispatchCanvas({ type: "POINT_BRIGHTNESS", brightness: 1.0 });
            
            // Use the annot_time from trackManager
            const points = await props.trackManager.fetchPointsAtTime(props.trackManager.annotTime);
            // Use the correct attribute index by subtracting numberOfDefaultColorByOptions
            const attributeIndex = props.colorByEvent.label - numberOfDefaultColorByOptions;
            const attributes = await props.trackManager.fetchAttributesAtTime(props.trackManager.annotTime, attributeIndex);
            
            // Calculate how many actual points we have (points array contains x,y,z for each point)
            const numPoints = points.length / 3;
            
            const selectedIndices: number[] = [];
            const selectedIds = new Set<number>();
            
            // Process only valid points
            for (let i = 0; i < numPoints && i < attributes.length; i++) {
                if (attributes[i] === 16711680) { // RED color
                    selectedIndices.push(i);
                    
                    // Calculate pointId using maxPointsPerTimepoint to match Python conversion
                    const pointId = props.trackManager.annotTime * props.trackManager.maxPointsPerTimepoint + i;
                    selectedIds.add(pointId);
                }
            }
            
            // Select the cells
            props.onSelectBinaryValue(selectedIndices, selectedIds);
            
        } catch (error) {
            console.error("Error during binary selection:", error);
        }
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
             props.colorByEvent.type === "hex-binary" && (
                <Button
                    sdsStyle="square"
                    sdsType="primary"
                    onClick={handleBinarySelection}
                >
                    Track Red Cells
                </Button>
            )}

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
