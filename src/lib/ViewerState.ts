import config from "../../CONFIG.ts";
import { Option, DEFAULT_DROPDOWN_OPTION } from "@/lib/TrackManager";
import { PointSelectionMode } from "./PointSelector.ts";

const DEFAULT_ZARR_URL = config.data.default_dataset;
const initialPointSize = config.settings.point_size;

const HASH_KEY = "viewerState";

// Clears the hash from the window's URL without triggering a hashchange
// event or an update to history.
export function clearUrlHash() {
    // Use this instead of setting window.location.hash to avoid triggering
    // a hashchange event (which would reset the state again).
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

// Encapsulates all the persistent state in the viewer (e.g. that can be serialized and shared).
export class ViewerState {
    dataUrl = DEFAULT_ZARR_URL;
    curTime = 0;
    minTime: number = -6;
    maxTime: number = 5;
    maxPointsPerTimepoint = 0;
    pointBrightness = 1.0;
    selectedPointIds: Array<number> = [];
    showTracks = true;
    showTrackHighlights = true;
    // Default position and target for the camera
    cameraPosition = [-4, 0, 0]; // was  [-1250, 500, 500];
    cameraTarget = [0, 0, 0]; // was  [500, 500, 500];
    pointSize: number = initialPointSize;
    trackWidthFactor: number = 1;
    colorBy: boolean = false;
    colorByEvent: Option = DEFAULT_DROPDOWN_OPTION;
    colormapTracks: string = config.settings.colormap_tracks || "coolwarm";
    colormapCellsCategorical: string = config.settings.colormap_colorby_categorical;
    colormapCellsContinuous: string = config.settings.colormap_colorby_continuous;
    selectionMode: PointSelectionMode | null = PointSelectionMode.BOX;
    // Imaging layer (e.g. Luxar splats). null = not specified, so the tracks
    // zarr's own imaging attributes (if any) apply.
    imagingUrl: string | null = null;
    imagingBrightness: number | null = null;
    sphereSelector: {
        position: [number, number, number];
        scale: [number, number, number];
        rotation: [number, number, number];
        visible: boolean;
    } = {
        position: [0, 0, 0],
        scale: [1, 1, 1],
        rotation: [0, 0, 0],
        visible: false,
    };

    toUrlHash(): string {
        // Use URLSearchParams to sanitize serialized string values for URL.
        const searchParams = new URLSearchParams();
        searchParams.append(HASH_KEY, JSON.stringify(this));
        return "#" + searchParams.toString();
    }

    static fromUrlHash(urlHash: string): ViewerState {
        console.debug("getting state from hash: %s", urlHash);
        const state = new ViewerState();
        // Remove the # from the hash to get the fragment, which
        // is encoded using URLSearchParams to handle special characters.
        const searchParams = new URLSearchParams(urlHash.slice(1));
        if (searchParams.has(HASH_KEY)) {
            // Fill in defaults for any field the link leaves out (e.g. a
            // hand-written link with no dataUrl).
            return Object.assign(state, JSON.parse(searchParams.get(HASH_KEY)!));
        } else if (urlHash.length > 0) {
            console.error("failed to find state key in hash: %s", urlHash);
        }
        return state;
    }
}
