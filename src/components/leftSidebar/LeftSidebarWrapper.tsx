import { TrackManager } from "@/lib/TrackManager";
import TrackControls from "./TrackControls";
import ControlInstructions from "./ControlInstructions";
import { PointSelectionMode } from "@/lib/PointSelector";
import { PointCanvas } from "@/lib/PointCanvas";
import { Divider } from "@mui/material";

// interface Action {
//     type: ActionType;
//     brightness?: number;
//     pointSize?: number;
//     // Add more fields for other actions as needed
// }

interface LeftSidebarWrapperProps {
    hasTracks: boolean;
    trackManager: TrackManager | null;
    trackHighlightLength: number;
    showTracks: boolean;
    setShowTracks: (showTracks: boolean) => void;
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
}

export default function LeftSidebarWrapper({
    hasTracks,
    trackManager,
    trackHighlightLength,
    showTracks,
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
}: LeftSidebarWrapperProps) {
    return (
        <>
            <TrackControls
                trackManager={trackManager}
                trackHighlightLength={trackHighlightLength}
                showTracks={showTracks}
                setShowTracks={setShowTracks}
                showTrackHighlights={showTrackHighlights}
                setShowTrackHighlights={setShowTrackHighlights}
                setTrackHighlightLength={setTrackHighlightLength}
                pointBrightness={canvas.pointBrightness}
                setPointBrightness={setPointBrightness}
                pointSize={canvas.pointSize}
                setPointSize={setPointSize}
                hasTracks={hasTracks}
                trackWidth={canvas.trackWidthRatio}
                setTrackWidth={setTrackWidth}
                axesVisible={axesVisible}
                toggleAxesVisible={toggleAxesVisible}
            />
            <Divider />
            {selectionMode !== null && <ControlInstructions selectionMode={selectionMode} isTablet={isTablet} />}
        </>
    );
}
