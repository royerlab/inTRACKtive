import { Vector3 } from "three";

export const DEFAULT_ZARR_URL = new URL(
    "https://sci-imaging-vis-public-demo-data.s3.us-west-2.amazonaws.com" +
        "/points-web-viewer/sparse-zarr-v2/ZSNS001_tracks_bundle.zarr",
);

const HASH_KEY = "viewerState";

// Encapsulates all the persistent state in the viewer (e.g. that can be serialized and shared).
export class ViewerState {
    dataUrl: URL;
    curTime: number;
    autoRotate: boolean;
    playing: boolean;
    cameraPosition: Vector3;
    cameraTarget: Vector3;

    constructor(
        dataUrl: URL = DEFAULT_ZARR_URL,
        curTime: number = 0,
        autoRotate: boolean = false,
        playing: boolean = false,
        // Default position and target from interacting with ZSNS001.
        cameraPosition: Vector3 = new Vector3(500, 500, -1250),
        cameraTarget: Vector3 = new Vector3(500, 500, 250),
    ) {
        this.dataUrl = dataUrl;
        this.curTime = curTime;
        this.autoRotate = autoRotate;
        this.playing = playing;
        this.cameraPosition = cameraPosition;
        this.cameraTarget = cameraTarget;
    }

    toUrlHash(): string {
        // Use SearchParams to sanitize serialized string values for URL.
        const searchParams = new URLSearchParams();
        searchParams.append(HASH_KEY, JSON.stringify(this));
        return searchParams.toString();
    }

    static fromUrlHash(urlHash: string) : ViewerState {
        console.debug("getting state from hash: %s", urlHash);
        const state = new ViewerState();
        // Remove the # from the hash to get the fragment.
        const searchParams = new URLSearchParams(urlHash.slice(1));
        if (searchParams.has(HASH_KEY)) {
            return JSON.parse(searchParams.get(HASH_KEY)!);
        }
        if (urlHash.length > 0) {
            console.error("failed to find state key in hash: %s", urlHash);
        }
        return new ViewerState();
    }
}