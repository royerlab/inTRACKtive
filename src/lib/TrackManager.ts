// @ts-expect-error - types for zarr are not working right now, but a PR is open https://github.com/gzuidhof/zarr.js/pull/149
import { ZarrArray, slice, Slice, openArray, NestedArray } from "zarr";
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
class ScaleSettings {
    meanX?: number;
    meanY?: number;
    meanZ?: number;
    extentXYZ?: number;

    public calculate(array: Float32Array, stride: number) {
        console.log(
            "scaleSettings not provided in zarr attribues, so they are calculated from first datapoint (stride %s)",
            stride,
        );

        let xTotal = 0;
        let yTotal = 0;
        let zTotal = 0;
        for (let i = 0; i < array.length; i += stride) {
            xTotal += array[i];
            yTotal += array[i + 1];
            zTotal += array[i + 2];
        }

        this.meanX = xTotal / (array.length / stride);
        this.meanY = yTotal / (array.length / stride);
        this.meanZ = zTotal / (array.length / stride);

        const extentX = Math.max(...array.map((x) => Math.abs(x - this.meanX!)));
        const extentY = Math.max(...array.map((x) => Math.abs(x - this.meanY!)));
        const extentZ = Math.max(...array.map((x) => Math.abs(x - this.meanZ!)));

        this.extentXYZ = Math.max(extentX, extentY, extentZ);
        console.log("scaleSettings after calculate", this);
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
    scaleSettings: ScaleSettings;
    defaultExtent: number;
    ndim: number;

    constructor(
        store: string,
        points: ZarrArray,
        pointsToTracks: SparseZarrArray,
        tracksToPoints: SparseZarrArray,
        tracksToTracks: SparseZarrArray,
        scaleSettings: ScaleSettings,
    ) {
        this.store = store;
        this.points = points;
        this.pointsToTracks = pointsToTracks;
        this.tracksToPoints = tracksToPoints;
        this.tracksToTracks = tracksToTracks;
        this.numTimes = points.shape[0];
        this.maxPointsPerTimepoint = points.shape[1] / numberOfValuesPerPoint; // default is /3
        this.scaleSettings = scaleSettings;
        this.defaultExtent = 1; // pointcloud is centered around (0,0,0) with an extent of 1
        this.ndim = 3;
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

        // scale the data to fit in the viewer
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

        // scale the data to fit in the viewer
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
        const extentXYZ = this.scaleSettings.extentXYZ ?? this.defaultExtent;

        if (numberOfValuesPerPoint == 4) {
            return (30 * this.defaultExtent) / extentXYZ; // 30 is the factor to match actual distances in tracks.csv to distances in the viewer
        } else {
            return pointSizeDefault;
        }
    }

    applyScale(array: Float32Array, stride: number): Float32Array {
        // if scaleSettings are undefined, calculated them from first frame
        if (
            this.scaleSettings.meanX === undefined ||
            this.scaleSettings.meanY === undefined ||
            this.scaleSettings.meanZ === undefined ||
            this.scaleSettings.extentXYZ === undefined
        ) {
            this.scaleSettings.calculate(array, numberOfValuesPerPoint);
        }
        const meanX = this.scaleSettings.meanX ?? 0;
        const meanY = this.scaleSettings.meanY ?? 0;
        const meanZ = this.scaleSettings.meanZ ?? 0;
        const extentXYZ = this.scaleSettings.extentXYZ ?? this.defaultExtent;
        for (let i = 0; i < array.length; i += stride) {
            array[i] = ((array[i] - meanZ) / extentXYZ) * this.defaultExtent;
            array[i + 1] = ((array[i + 1] - meanY) / extentXYZ) * this.defaultExtent;
            array[i + 2] = ((array[i + 2] - meanX) / extentXYZ) * this.defaultExtent;
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
        const scaleSettings = new ScaleSettings();
        try {
            const zattrs = await points.attrs.asObject();
            numberOfValuesPerPoint = zattrs["values_per_point"];
            scaleSettings.meanX = zattrs["mean_x"];
            scaleSettings.meanY = zattrs["mean_y"];
            scaleSettings.meanZ = zattrs["mean_z"];
            scaleSettings.extentXYZ = zattrs["extent_xyz"];
            console.log("TM scaleSettings from zattrs", scaleSettings);
        } catch (error) {
            numberOfValuesPerPoint = 3;
        }

        let datasetNdim = 3;
        try {
            const zattrs = await points.attrs.asObject();
            datasetNdim = zattrs["ndim"];
        } catch (error) {
            console.error("Error getting ndim from zattrs: %s", error);
        }

        const pointsToTracks = await openSparseZarrArray(url, "points_to_tracks", false);
        const tracksToPoints = await openSparseZarrArray(url, "tracks_to_points", true);
        const tracksToTracks = await openSparseZarrArray(url, "tracks_to_tracks", true);

        // make trackManager, and reset "maxPointsPerTimepoint", because tm constructor does points/3
        trackManager = new TrackManager(url, points, pointsToTracks, tracksToPoints, tracksToTracks, scaleSettings);
        if (numberOfValuesPerPoint == 4) {
            trackManager.maxPointsPerTimepoint = trackManager.points.shape[1] / numberOfValuesPerPoint;
        }
        if (datasetNdim == 2) {
            trackManager.ndim = 2;
            console.debug("2D datast detected in loadTrackManager");
        }
    } catch (err) {
        console.error("Error opening TrackManager: %s", err);
        trackManager = null;
    }
    console.log("loaded new TrackManager: %s", trackManager);
    return trackManager;
}
