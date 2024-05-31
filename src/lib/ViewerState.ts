import { Vector3 } from "three";
import { TrackManager } from "@/lib/TrackManager";
import { PointCanvas } from "@/lib/PointCanvas";

export const DEFAULT_ZARR_URL =
    "https://sci-imaging-vis-public-demo-data.s3.us-west-2.amazonaws.com" +
    "/points-web-viewer/sparse-zarr-v2/ZSNS001_tracks_bundle.zarr";

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
    selectedTrackIds: Array<number> = [];
    // Default position and target from interacting with ZSNS001.
    cameraPosition = new Vector3(500, 500, -1250);
    cameraTarget = new Vector3(500, 500, 250);

    toUrlHash(): string {
        // Use URLSearchParams to sanitize serialized string values for URL.
        const searchParams = new URLSearchParams();
        searchParams.append(HASH_KEY, JSON.stringify(this));
        return "#" + searchParams.toString();
    }

    static fromAppState(trackManager: TrackManager | null, pointCanvas: PointCanvas): ViewerState {
        const state = new ViewerState();
        state.dataUrl = trackManager?.store ?? DEFAULT_ZARR_URL;
        state.curTime = pointCanvas.curTime;
        state.selectedTrackIds = new Array(...pointCanvas.selectedTrackIds);
        state.cameraPosition = pointCanvas.camera.position.clone();
        state.cameraTarget = pointCanvas.controls.target.clone();
        return state;
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
