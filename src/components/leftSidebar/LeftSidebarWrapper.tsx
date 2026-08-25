import { Option, TrackManager } from "@/lib/TrackManager";
import TrackControls from "./TrackControls";
import ControlInstructions from "./ControlInstructions";
import { PointSelectionMode } from "@/lib/PointSelector";
import { PointCanvas } from "@/lib/PointCanvas";
import { Divider } from "@mui/material";

interface LeftSidebarWrapperProps {
    hasTracks: boolean;
    trackManager: TrackManager | null;
    trackHighlightLength: number;
    showTracks: boolean;
    setShowTracks: (showTracks: boolean) => void;
    hasImaging: boolean;
    showImaging: boolean;
    setShowImaging: (showImaging: boolean) => void;
    imagingBrightness: number;
    setImagingBrightness: (imagingBrightness: number) => void;
    showTrackHighlights: boolean;
    setShowTrackHighlights: (showTrackHighlights: boolean) => void;
    setTrackHighlightLength: (trackHighlightLength: number) => void;
    selectionMode: PointSelectionMode | null;
    isTablet: boolean;
    canvas: PointCanvas;
    setPointBrightness: (brightness: number) => void;
    setPointSize: (pointSize: number) => void;
    setTrackWidth: (ratio: number) => void;
    axesVisible: boolean;
    toggleAxesVisible: () => void;
    colorBy: boolean;
    colorByEvent: Option;
    toggleColorBy: (colorBy: boolean) => void;
    changeColorBy: (value: Option) => void;
    colormapTracks: string;
    setColormapTracks: (name: string) => void;
    colormapCells: string;
    setColormapCells: (name: string) => void;
}

export default function LeftSidebarWrapper({
    hasTracks,
    trackManager,
    trackHighlightLength,
    showTracks,
    hasImaging,
    showImaging,
    setShowImaging,
    imagingBrightness,
    setImagingBrightness,
    setShowTracks,
    showTrackHighlights,
    setShowTrackHighlights,
    setTrackHighlightLength,
    selectionMode,
    isTablet,
    canvas,
    setPointBrightness,
    setPointSize,
    setTrackWidth,
    axesVisible,
    toggleAxesVisible,
    colorBy,
    toggleColorBy,
    colorByEvent,
    changeColorBy,
    colormapTracks,
    setColormapTracks,
    colormapCells,
    setColormapCells,
}: LeftSidebarWrapperProps) {
    return (
        <>
            <TrackControls
                trackManager={trackManager}
                trackHighlightLength={trackHighlightLength}
                showTracks={showTracks}
                hasImaging={hasImaging}
                showImaging={showImaging}
                setShowImaging={setShowImaging}
                imagingBrightness={imagingBrightness}
                setImagingBrightness={setImagingBrightness}
                setShowTracks={setShowTracks}
                showTrackHighlights={showTrackHighlights}
                setShowTrackHighlights={setShowTrackHighlights}
                setTrackHighlightLength={setTrackHighlightLength}
                pointBrightness={canvas.pointBrightness}
                setPointBrightness={setPointBrightness}
                pointSize={canvas.pointSize}
                setPointSize={setPointSize}
                hasTracks={hasTracks}
                trackWidth={canvas.trackWidthFactor}
                setTrackWidth={setTrackWidth}
                axesVisible={axesVisible}
                toggleAxesVisible={toggleAxesVisible}
                colorBy={colorBy}
                toggleColorBy={toggleColorBy}
                colorByEvent={colorByEvent}
                changeColorBy={changeColorBy}
                colormapTracks={colormapTracks}
                setColormapTracks={setColormapTracks}
                colormapCells={colormapCells}
                setColormapCells={setColormapCells}
            />
            <Divider />
            {selectionMode !== null && <ControlInstructions selectionMode={selectionMode} isTablet={isTablet} />}
        </>
    );
}
