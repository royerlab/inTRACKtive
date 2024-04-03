import { Vector3 } from "three";
import { PointsCollection } from "./PointSelectionBox";

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

// Define custom replacer and revivers to handle types that do
// not automatically deserialize from JSON. Adapted from:
// https://stackoverflow.com/questions/29085197/how-do-you-json-stringify-an-es6-map
function replacer(_key: string, value: any) {
    if (value instanceof Map) {
        return {
            dataType: "Map",
            entries: Array.from(value.entries()), // or with spread: value: [...value]
        };
    } else if (value instanceof Vector3) {
        return {
            dataType: "Vector3",
            elements: [value.x, value.y, value.z],
        };
    }
    return value;
}

function reviver(_key: string, value: any) {
    if (typeof value === "object" && value !== null) {
        if (value.dataType === "Map") {
            return new Map(value.entries);
        } else if (value.dataType === "Vector3") {
            return new Vector3(...value.elements);
        }
    }
    return value;
}

// Encapsulates all the persistent state in the viewer (e.g. that can be serialized and shared).
export class ViewerState {
    dataUrl: string;
    curTime: number;
    cameraPosition: Vector3;
    cameraTarget: Vector3;
    selectedPoints: PointsCollection;
    trackHighlightLength: number;

    constructor(
        dataUrl: string = DEFAULT_ZARR_URL,
        curTime: number = 0,
        // Default position and target from interacting with ZSNS001.
        cameraPosition: Vector3 = new Vector3(500, 500, -1250),
        cameraTarget: Vector3 = new Vector3(500, 500, 250),
        selectedPoints: PointsCollection = new Map(),
        trackHighlightLength: number = 11,
    ) {
        this.dataUrl = dataUrl;
        this.curTime = curTime;
        this.cameraPosition = cameraPosition;
        this.cameraTarget = cameraTarget;
        this.selectedPoints = selectedPoints;
        this.trackHighlightLength = trackHighlightLength;
    }

    toUrlHash(): string {
        // Use SearchParams to sanitize serialized string values for URL.
        const searchParams = new URLSearchParams();
        searchParams.append(HASH_KEY, JSON.stringify(this, replacer));
        return "#" + searchParams.toString();
    }

    static fromUrlHash(urlHash: string): ViewerState {
        console.debug("getting state from hash: %s", urlHash);
        const state = new ViewerState();
        // Remove the # from the hash to get the fragment.
        const searchParams = new URLSearchParams(urlHash.slice(1));
        if (searchParams.has(HASH_KEY)) {
            return Object.assign(state, JSON.parse(searchParams.get(HASH_KEY)!, reviver));
        } else if (urlHash.length > 0) {
            console.error("failed to find state key in hash: %s", urlHash);
        }
        return state;
    }
}
