import { Box, Stack } from "@mui/material";
import { InputSlider, SegmentedControl, SingleButtonDefinition, Button } from "@czi-sds/components";
import { FontS, SmallCapsButton, ControlLabel } from "@/components/Styled";
import { PointSelectionMode } from "@/lib/PointSelector";
import { TrackManager } from "@/lib/TrackManager";
import { DownloadButton } from "./DownloadButton";

interface CellControlsProps {
    clearTracks: () => void;
    getTrackDownloadData: () => string[][];
    numSelectedCells?: number;
    numSelectedTracks?: number;
    trackManager: TrackManager | null;
    selectionMode: PointSelectionMode | null;
    setSelectionMode: (value: PointSelectionMode) => void;
    isTablet: boolean;
    MobileSelectCells: () => void;
    setSelectorScale: (value: number) => void;
    selectorScale: number;
}

export default function CellControls(props: CellControlsProps) {
    const buttonDefinition: SingleButtonDefinition[] = [
        { icon: "Cube", tooltipText: "Box", value: PointSelectionMode.BOX },
        { icon: "Starburst", tooltipText: "Sphere", value: PointSelectionMode.SPHERICAL_CURSOR },
        { icon: "Globe", tooltipText: "Adjustable sphere", value: PointSelectionMode.SPHERE },
    ];

    // Intercept onChange of selection buttons to prevent the first two buttons from being selected on mobile devices
    const handleSegmentedControlChange = (_e: React.MouseEvent<HTMLElement>, newValue: PointSelectionMode | null) => {
        // If isTablet is true and the selected value corresponds to the first or second button, do nothing
        if (
            props.isTablet &&
            (newValue === PointSelectionMode.BOX || newValue === PointSelectionMode.SPHERICAL_CURSOR)
        ) {
            window.alert("This selection mode is not available on mobile devices.");
            console.log("Mobile device detected, preventing selection of box or spherical cursor");
            return; // Prevent selection
        }
        props.setSelectionMode(newValue!); // Otherwise, update the selection mode
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
            {/* Selection mode buttons */}
            <label htmlFor="selection-mode-control">
                <ControlLabel>Selection Mode</ControlLabel>
            </label>
            <Box display="flex" flexDirection="row" justifyContent="space-around">
                <SegmentedControl
                    id="selection-mode-control"
                    buttonDefinition={buttonDefinition}
                    onChange={handleSegmentedControlChange}
                    value={props.selectionMode}
                />
            </Box>
            {/* Select cells button */}
            <Box display="flex" justifyContent="center" alignItems="center">
                {props.isTablet && props.selectionMode === PointSelectionMode.SPHERE && (
                    <Button sdsStyle="square" sdsType="primary" onClick={props.MobileSelectCells}>
                        Select cells
                    </Button>
                )}
            </Box>
            {/* Selector radius slider */}
            {(props.selectionMode === PointSelectionMode.SPHERICAL_CURSOR ||
                props.selectionMode === PointSelectionMode.SPHERE) &&
                props.isTablet && (
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
