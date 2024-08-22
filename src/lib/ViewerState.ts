// export const DEFAULT_ZARR_URL =
//     "https://sci-imaging-vis-public-demo-data.s3.us-west-2.amazonaws.com" +
//     "/points-web-viewer/sparse-zarr-v2/ZSNS001_tracks_bundle.zarr";

// public Ascidian dataset that contains radius:
export const DEFAULT_ZARR_URL =
    "https://public.czbiohub.org/royerlab/zoo/Ascidian/tracks_withSize_centered_bundle.zarr/";
// export const DEFAULT_ZARR_URL = "https://public.czbiohub.org/royerlab/zoo/misc/tracks_withSize_3dots_bundle.zarr/";

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
    // Default position and target from interacting with ZSNS001.
    cameraPosition = [500, 500, -1250];
    cameraTarget = [500, 500, 250];

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
            return JSON.parse(searchParams.get(HASH_KEY)!);
        } else if (urlHash.length > 0) {
            console.error("failed to find state key in hash: %s", urlHash);
        }
        return state;
    }
}
