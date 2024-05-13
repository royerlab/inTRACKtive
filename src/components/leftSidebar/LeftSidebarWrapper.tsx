import { TrackManager } from "@/lib/TrackManager";
import TrackControls from "./TrackControls";
import ControlInstructions from "./ControlInstructions";

interface LeftSidebarWrapperProps {
    hasTracks: boolean;
    trackManager: TrackManager | null;
    trackHighlightLength: number;
    showTracks: boolean;
    setShowTracks: (showTracks: boolean) => void;
    showTrackHighlights: boolean;
    setShowTrackHighlights: (showTrackHighlights: boolean) => void;
    setTrackHighlightLength: (trackHighlightLength: number) => void;
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
}: LeftSidebarWrapperProps) {
    return (
        <>
            {hasTracks ? (
                <TrackControls
                    trackManager={trackManager}
                    trackHighlightLength={trackHighlightLength}
                    showTracks={showTracks}
                    setShowTracks={setShowTracks}
                    showTrackHighlights={showTrackHighlights}
                    setShowTrackHighlights={setShowTrackHighlights}
                    setTrackHighlightLength={setTrackHighlightLength}
                />
            ) : (
                <ControlInstructions />
            )}
        </>
    );
}