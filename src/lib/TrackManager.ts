// @ts-expect-error - types for zarr are not working right now, but a PR is open https://github.com/gzuidhof/zarr.js/pull/149
import { ZarrArray, slice, Slice, openArray, NestedArray, HTTPStore } from "zarr";
export let numberOfValuesPerPoint = 0; // 3 if points=[x,y,z], 4 if points=[x,y,z,size]

import config from "../../CONFIG.ts";
const pointSizeDefault = config.settings.point_size;

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

// class that contains the settings to "scale" the data, i.e., scale and center the dataset to fit nicely in the viewer
class scaleSettings {
    meanX?: number;
    meanY?: number;
    meanZ?: number;
    extendXYZ?: number;
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
    scaleSettings: scaleSettings;

    constructor(
        store: string,
        points: ZarrArray,
        pointsToTracks: SparseZarrArray,
        tracksToPoints: SparseZarrArray,
        tracksToTracks: SparseZarrArray,
        scaleSettings: scaleSettings,
    ) {
        this.store = store;
        this.points = points;
        this.pointsToTracks = pointsToTracks;
        this.tracksToPoints = tracksToPoints;
        this.tracksToTracks = tracksToTracks;
        this.numTimes = points.shape[0];
        this.maxPointsPerTimepoint = points.shape[1] / numberOfValuesPerPoint; // default is /3
        this.scaleSettings = scaleSettings;
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
        } else if (endIndex % numberOfValuesPerPoint !== 0) {
            console.error("invalid points - %d not divisible by %d", endIndex, numberOfValuesPerPoint);
            endIndex -= endIndex % numberOfValuesPerPoint;
        }

        // scale the data to fit in the viewer (center around 370, extend of 100)
        const array = this.applyScale(points.subarray(0, endIndex), numberOfValuesPerPoint);
        return array;
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
        let flatPoints = new Float32Array(points.length * 3);
        for (let i = 0; i < points.length; i++) {
            flatPoints.set(points[i], i * 3);
        }

        // scale the data to fit in the viewer (center around 370, extend of 100)
        flatPoints = this.applyScale(flatPoints, 3);
        return [flatPoints, pointIDs];
    }

    async fetchLineageForTrack(trackID: number): Promise<[Int32Array, Int32Array]> {
        const rowStartEnd = await this.tracksToTracks.getIndPtr(slice(trackID, trackID + 2));
        const lineage = await this.tracksToTracks.indices
            .get([slice(rowStartEnd[0], rowStartEnd[1])])
            .then((lineage: SparseZarrArray) => lineage.data);
        const trackData = await this.tracksToTracks.data
            .get([slice(rowStartEnd[0], rowStartEnd[1])])
            .then((trackData: SparseZarrArray) => trackData.data);
        return Promise.all([lineage, trackData]);
    }

    getPointSize(): number {
        const num = numberOfValuesPerPoint;
        const extendXYZ = this.scaleSettings.extendXYZ ?? 100;

        if (num == 4) {
            return (27 * 100) / extendXYZ; // 27 is the factor to match actual distances in tracks.csv to distances in the viewer
        } else {
            return pointSizeDefault;
        }
    }

    applyScale(array: Float32Array, stride: number): Float32Array {
        const meanX = this.scaleSettings.meanX ?? 0;
        const meanY = this.scaleSettings.meanY ?? 0;
        const meanZ = this.scaleSettings.meanX ?? 0;
        const extendXYZ = this.scaleSettings.extendXYZ ?? 100;
        for (let i = 0; i < array.length; i += stride) {
            array[i] = ((array[i] - meanZ) / extendXYZ) * 100 + 370;
            array[i + 1] = ((array[i + 1] - meanY) / extendXYZ) * 100 + 370;
            array[i + 2] = ((array[i + 2] - meanX) / extendXYZ) * 100 + 370;
        }
        return array;
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

        // load the zarr metadata (to know is radius is included)
        const scaleSettings: scaleSettings = {};
        try {
            const store = new HTTPStore(url);
            const zattrsResponse = await store.getItem("points/.zattrs");
            const zattrs = JSON.parse(new TextDecoder().decode(zattrsResponse));
            numberOfValuesPerPoint = zattrs["values_per_point"];

            scaleSettings.meanX = zattrs["mean_x"];
            scaleSettings.meanY = zattrs["mean_y"];
            scaleSettings.meanZ = zattrs["mean_z"];
            scaleSettings.extendXYZ = zattrs["extend_xyz"];
        } catch (error) {
            numberOfValuesPerPoint = 3;
        }

        const pointsToTracks = await openSparseZarrArray(url, "points_to_tracks", false);
        const tracksToPoints = await openSparseZarrArray(url, "tracks_to_points", true);
        const tracksToTracks = await openSparseZarrArray(url, "tracks_to_tracks", true);

        // make trackManager, and reset "maxPointsPerTimepoint", because tm constructor does points/3
        trackManager = new TrackManager(url, points, pointsToTracks, tracksToPoints, tracksToTracks, scaleSettings);
        if (numberOfValuesPerPoint == 4) {
            trackManager.maxPointsPerTimepoint = trackManager.points.shape[1] / numberOfValuesPerPoint;
        }
    } catch (err) {
        console.error("Error opening TrackManager: %s", err);
        trackManager = null;
    }
    console.log("loaded new TrackManager: %s", trackManager);
    return trackManager;
}
