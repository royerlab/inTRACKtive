// @ts-expect-error - types for zarr are not working right now, but a PR is open https://github.com/gzuidhof/zarr.js/pull/149
import { ZarrArray, slice, openArray } from "zarr";

class SparseZarrArray {
    store: string;
    groupPath: string;
    // TODO: indptr is pretty small, could be loaded into memory
    indptr: ZarrArray;
    indices: ZarrArray;
    data: ZarrArray | null;

    constructor(store: string, groupPath: string, indptr: ZarrArray, indices: ZarrArray, data: ZarrArray | null) {
        this.store = store;
        this.groupPath = groupPath;
        this.indptr = indptr;
        this.indices = indices;
        this.data = data;
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

    let data;
    if (!hasData) {
        data = null;
    } else {
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
    // tracksToTracks: SparseZarrArray;

    constructor(
        store: string,
        points: ZarrArray,
        pointsToTracks: SparseZarrArray,
        tracksToPoints: SparseZarrArray,
        // tracksToTracks: SparseZarrArray,
    ) {
        this.store = store;
        this.points = points;
        this.pointsToTracks = pointsToTracks;
        this.tracksToPoints = tracksToPoints;
    }

    async getPointsAtTime(timeIndex: number): Promise<Float32Array> {
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

    async fetchTrackIDsForPoint(pointID: number): Promise<Uint32Array> {
        const rowStartEnd = await this.pointsToTracks.indptr.get([slice(pointID, pointID + 2)]);
        const trackIDs = await this.pointsToTracks.indices.get([slice(rowStartEnd.data[0], rowStartEnd.data[1])]);
        return trackIDs.data;
    }

    async fetchPointIDsForTrack(trackID: number): Promise<Uint32Array> {
        const rowStartEnd = await this.tracksToPoints.indptr.get([slice(trackID, trackID + 2)]);
        const pointIDs = await this.tracksToPoints.indices.get([slice(rowStartEnd.data[0], rowStartEnd.data[1])]);
        return pointIDs.data;
    }

    async fetchPointsForTrack(trackID: number): Promise<Float32Array> {
        const rowStartEnd = await this.tracksToPoints.indptr.get([slice(trackID, trackID + 2)]);
        console.log("fetchPointsForTrack: %d", trackID, rowStartEnd);
        const points = await this.tracksToPoints.data.get([
            slice(rowStartEnd.data[0], rowStartEnd.data[1]),
            slice(null),
        ]);
        // flatten the resulting n x 3 array in to a 1D [xyzxyzxyz...] array
        const flatPoints = new Float32Array(points.data.length * 3);
        for (let i = 0; i < points.data.length; i++) {
            flatPoints.set(points.data[i], i * 3);
        }
        return flatPoints;
    }
}

export async function loadTrackManager(store: string, path: string) {
    let trackManager;
    try {
        trackManager = await openTrackManager(
            store,
            path,
            "ZSNS001_points_to_tracks.zarr",
            "ZSNS001_tracks_to_points.zarr",
        );
    } catch (err) {
        console.error("Error opening TrackManager: %s", err);
        trackManager = null;
    }
    console.log("loaded new TrackManager: %s", trackManager);
    return trackManager;
}

async function openTrackManager(
    store: string,
    pointsPath: string,
    pointsToTracksPath: string,
    tracksToPointsPath: string,
): Promise<TrackManager> {
    const points = await openArray({
        store: store,
        path: pointsPath,
        mode: "r",
    });
    const pointsToTracks = await openSparseZarrArray(store, pointsToTracksPath, false);
    const tracksToPoints = await openSparseZarrArray(store, tracksToPointsPath, true);
    return new TrackManager(store, points, pointsToTracks, tracksToPoints);
}
