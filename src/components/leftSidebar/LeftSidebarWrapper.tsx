import { TrackManager } from "@/lib/TrackManager";
import TrackControls from "./TrackControls";
import ControlInstructions from "./ControlInstructions";

interface LeftSidebarWrapperProps {
    arePointsSelected: boolean;
    trackManager: TrackManager | null;
    trackHighlightLength: number;
    setTrackHighlightLength: (trackHighlightLength: number) => void;
    clearTracks: () => void;
}

export default function LeftSidebarWrapper({
    arePointsSelected,
    trackManager,
    trackHighlightLength,
    setTrackHighlightLength,
    clearTracks,
}: LeftSidebarWrapperProps) {
    return (
        <>
            {arePointsSelected ? (
                <TrackControls
                    trackManager={trackManager}
                    trackHighlightLength={trackHighlightLength}
                    setTrackHighlightLength={setTrackHighlightLength}
                    clearTracks={clearTracks}
                />
            ) : (
                <ControlInstructions />
            )}
        </>
    );
}
