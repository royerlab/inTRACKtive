import { Vector3 } from "three";

export const DEFAULT_ZARR_URL = new URL(
    "https://sci-imaging-vis-public-demo-data.s3.us-west-2.amazonaws.com" +
        "/points-web-viewer/sparse-zarr-v2/ZSNS001_tracks_bundle.zarr",
);

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
        searchParams.append("dataUrl", this.dataUrl.toString());
        searchParams.append("curTime", this.curTime.toString());
        searchParams.append("autoRotate", this.autoRotate.toString());
        searchParams.append("playing", this.playing.toString());
        searchParams.append("cameraPosition", JSON.stringify(this.cameraPosition));
        searchParams.append("cameraTarget", JSON.stringify(this.cameraTarget));
        return searchParams.toString();
    }

    // This consumes the window's location hash and has the side effect of clearing it.
    static fromUrlHash() {
        const urlHash = window.location.hash;
        console.log("getting state from hash: %s", urlHash);
        const state = new ViewerState();
        const searchParams = new URLSearchParams(urlHash.slice(1));
        if (searchParams.has("dataUrl")) {
            state.dataUrl = new URL(searchParams.get("dataUrl")!);
        }
        if (searchParams.has("curTime")) {
            state.curTime = parseInt(searchParams.get("curTime")!);
        }
        if (searchParams.has("autoRotate")) {
            state.autoRotate = searchParams.get("autoRotate") === "true";
        }
        if (searchParams.get("playing")) {
            state.playing = searchParams.get("playing") === "true";
        }
        if (searchParams.get("cameraPosition")) {
            state.cameraPosition = JSON.parse(searchParams.get("cameraPosition")!);
        }
        if (searchParams.get("cameraTarget")) {
            state.cameraTarget = JSON.parse(searchParams.get("cameraTarget")!);
        }
        // Reset hash once initial state is consumed to keep URL clean.
        // Use this instead of setting window.location.hash to avoid triggering
        // a hashchange event (which would reset the state again).
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        return state;
    }
}
