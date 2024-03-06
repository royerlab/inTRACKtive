import { PointsCollection } from "./PointSelectionBox";
import { Vector3 } from "three";

export const DEFAULT_ZARR_URL = new URL(
    "https://sci-imaging-vis-public-demo-data.s3.us-west-2.amazonaws.com" +
        "/points-web-viewer/sparse-zarr-v2/ZSNS001_tracks_bundle.zarr",
);

export class ViewerState {
    dataUrl: URL;
    curTime: number;
    autoRotate: boolean;
    playing: boolean;
    selectedPoints: PointsCollection;
    cameraPosition: Vector3;
    cameraTarget: Vector3;

    constructor(
        dataUrl: URL = DEFAULT_ZARR_URL,
        curTime: number = 0,
        autoRotate: boolean = false,
        playing: boolean = false,
        selectedPoints: PointsCollection = {},
        // Default position from interacting with ZSNS001
        cameraPosition: Vector3 = new Vector3(500, 500, -1250),
        cameraTarget: Vector3 = new Vector3(500, 500, 250),
    ) {
        this.dataUrl = dataUrl;
        this.curTime = curTime;
        this.autoRotate = autoRotate;
        this.playing = playing;
        this.selectedPoints = selectedPoints;
        this.cameraPosition = cameraPosition;
        this.cameraTarget = cameraTarget;
    }

    toUrlHash(): string {
        // Use SearchParams to sanitize serialized string values for URL.
        // TODO: alternatively or in addition, allow base64 encoding of the whole state
        // which is sanitary by default.
        const searchParams = new URLSearchParams();
        searchParams.append("dataUrl", this.dataUrl.toString());
        searchParams.append("curTime", this.curTime.toString());
        searchParams.append("autoRotate", this.autoRotate.toString());
        searchParams.append("playing", this.playing.toString());
        searchParams.append("selectedPoints", JSON.stringify(this.selectedPoints));
        searchParams.append("cameraPosition", JSON.stringify(this.cameraPosition));
        searchParams.append("cameraTarget", JSON.stringify(this.cameraTarget));
        return searchParams.toString();
    }
}

export function viewerStateFromUrlHash(): ViewerState {
    const state = new ViewerState();
    const urlHash = window.location.hash;
    console.log("getting state from hash: %s", document.location.hash);
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
    if (searchParams.get("selectedPoints")) {
        state.selectedPoints = JSON.parse(searchParams.get("selectedPoints")!);
    }
    if (searchParams.get("cameraPosition")) {
        state.cameraPosition = JSON.parse(searchParams.get("cameraPosition")!);
    }
    if (searchParams.get("cameraTarget")) {
        state.cameraTarget = JSON.parse(searchParams.get("cameraTarget")!);
    }
    return state;
}
