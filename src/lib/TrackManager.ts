// @ts-expect-error - types for zarr are not working right now, but a PR is open https://github.com/gzuidhof/zarr.js/pull/149
import { ZarrArray, slice, Slice, openArray, NestedArray } from "zarr";

class SparseZarrArray {
    store: string;
    groupPath: string;
    // TODO: indptr is pretty small, could be loaded into memory
    indptr: ZarrArray;
    indptrCache: Promise<Int32Array> | Int32Array | null = null;
    indices: ZarrArray;
    data: ZarrArray | null;

    constructor(store: string, groupPath: string, indptr: ZarrArray, indices: ZarrArray, data: ZarrArray | null) {
        this.store = store;
        this.groupPath = groupPath;
        this.indptr = indptr;
        this.indices = indices;
        this.data = data;
    }

    async getIndPtr(s: Slice): Promise<Int32Array> {
        // TODO: this may not be a good way to cache this data
        if (this.indptrCache === null) {
            this.indptrCache = this.indptr.get([null]).then((data: NestedArray) => {
                this.indptrCache = data.data;
            });
        }

        let result;
        if (this.indptrCache instanceof Promise) {
            result = (await this.indptr.get(s)).data;
        } else if (this.indptrCache instanceof Int32Array) {
            result = this.indptrCache.subarray(s.start, s.stop);
        }
        return result;
    }
}

export async function openSparseZarrArray(store: string, groupPath: string, hasData = true): Promise<SparseZarrArray> {
    // TODO: check for sparse_format in group .zattrs
    const indptr = await openArray({
        store: store,
        path: groupPath + "/indptr",
        mode: "r",
    });
    const indices = await openArray({
        store: store,
        path: groupPath + "/indices",
        mode: "r",
    });

    let data = null;
    if (hasData) {
        data = await openArray({
            store: store,
            path: groupPath + "/data",
            mode: "r",
        });
    }

    return new SparseZarrArray(store, groupPath, indptr, indices, data);
}

export class TrackManager {
    store: string;
    points: ZarrArray;
    pointsToTracks: SparseZarrArray;
    tracksToPoints: SparseZarrArray;
    tracksToTracks: SparseZarrArray;
    numTimes: number;
    maxPointsPerTimepoint: number;

    constructor(
        store: string,
        points: ZarrArray,
        pointsToTracks: SparseZarrArray,
        tracksToPoints: SparseZarrArray,
        tracksToTracks: SparseZarrArray,
    ) {
        this.store = store;
        this.points = points;
        this.pointsToTracks = pointsToTracks;
        this.tracksToPoints = tracksToPoints;
        this.tracksToTracks = tracksToTracks;
        this.numTimes = points.shape[0];
        this.maxPointsPerTimepoint = points.shape[1] / 3;
    }

    async fetchPointsAtTime(timeIndex: number): Promise<Float32Array> {
        console.debug("fetchPointsAtTime: %d", timeIndex);

        const points: Float32Array = (await this.points.get([timeIndex, slice(null)])).data;

        // assume points < -127 are invalid, and all are at the end of the array
        // this is how the jagged array is stored in the zarr
        // for Float32 it's actually -9999, but the int8 data is -127
        let endIndex = points.findIndex((value) => value <= -127);
        if (endIndex === -1) {
            endIndex = points.length;
        } else if (endIndex % 3 !== 0) {
            console.error("invalid points - %d not divisible by 3", endIndex);
            endIndex -= endIndex % 3;
        }
        return points.subarray(0, endIndex);
    }

    async fetchTrackIDsForPoint(pointID: number): Promise<Int32Array> {
        const rowStartEnd = await this.pointsToTracks.getIndPtr(slice(pointID, pointID + 2));
        const trackIDs = await this.pointsToTracks.indices.get([slice(rowStartEnd[0], rowStartEnd[1])]);
        return trackIDs.data;
    }

    async fetchPointsForTrack(trackID: number): Promise<[Float32Array, Int32Array]> {
        const rowStartEnd = await this.tracksToPoints.getIndPtr(slice(trackID, trackID + 2));
        const points = (await this.tracksToPoints.data.get([slice(rowStartEnd[0], rowStartEnd[1]), slice(null)])).data;
        // TODO: can bake this into the data array
        const pointIDs = (await this.tracksToPoints.indices.get([slice(rowStartEnd[0], rowStartEnd[1])])).data;

        if (points.length !== pointIDs.length) {
            console.error("points and pointIDs are different lengths: %d, %d", points.length, pointIDs.length);
        }

        // flatten the resulting n x 3 array in to a 1D [xyzxyzxyz...] array
        const flatPoints = new Float32Array(points.length * 3);
        for (let i = 0; i < points.length; i++) {
            flatPoints.set(points[i], i * 3);
        }

        return [flatPoints, pointIDs];
    }

    async fetchLineageForTrack(trackID: number): Promise<Int32Array> {
        const rowStartEnd = await this.tracksToTracks.getIndPtr(slice(trackID, trackID + 2));
        const lineage = await this.tracksToTracks.indices.get([slice(rowStartEnd[0], rowStartEnd[1])]);
        return lineage.data;
    }
}

export async function loadTrackManager(url: string) {
    let trackManager;
    try {
        const points = await openArray({
            store: url,
            path: "points",
            mode: "r",
        });
        const pointsToTracks = await openSparseZarrArray(url, "points_to_tracks", false);
        const tracksToPoints = await openSparseZarrArray(url, "tracks_to_points", true);
        const tracksToTracks = await openSparseZarrArray(url, "tracks_to_tracks", false);
        trackManager = new TrackManager(url, points, pointsToTracks, tracksToPoints, tracksToTracks);
    } catch (err) {
        console.error("Error opening TrackManager: %s", err);
        trackManager = null;
    }
    console.log("loaded new TrackManager: %s", trackManager);
    return trackManager;
}
