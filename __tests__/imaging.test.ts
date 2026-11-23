import { describe, expect, test } from "vitest";

import { spatialPermutation, timeDimension, trackAlignmentMatrix } from "@/lib/ImagingLayer";
import { parseDatasetImaging } from "@/lib/TrackManager";

describe("parseDatasetImaging", () => {
    const store = "https://example.org/data/tracks.zarr";

    test("resolves a relative url inside the tracks zarr's folder", () => {
        const got = parseDatasetImaging({ imaging: [{ url: "../imaging.luxar.zarr", brightness: 2 }] }, store);
        expect(got).toEqual({ url: "https://example.org/data/imaging.luxar.zarr", brightness: 2 });
    });

    test("keeps an absolute url and tolerates a trailing slash on the store", () => {
        const got = parseDatasetImaging({ imaging: [{ url: "http://host/x.luxar.zarr" }] }, store + "/");
        expect(got).toEqual({ url: "http://host/x.luxar.zarr", brightness: undefined });
    });

    test("returns null when absent or malformed", () => {
        expect(parseDatasetImaging({}, store)).toBeNull();
        expect(parseDatasetImaging({ imaging: [] }, store)).toBeNull();
        expect(parseDatasetImaging({ imaging: [{ brightness: 1 }] }, store)).toBeNull();
        expect(parseDatasetImaging({ imaging: "x" }, store)).toBeNull();
        expect(parseDatasetImaging(null, store)).toBeNull();
    });
});

describe("ImagingLayer helpers", () => {
    test("spatialPermutation reads named axes and falls back to identity", () => {
        expect(spatialPermutation(["x", "y", "z", "t"])).toEqual([2, 1, 0]);
        expect(spatialPermutation(["Z", "Y", "X", "time"])).toEqual([0, 1, 2]);
        expect(spatialPermutation(["dim0", "dim1", "dim2", "dim3"])).toEqual([0, 1, 2]);
    });

    test("timeDimension prefers the name, else the sole hidden axis", () => {
        expect(timeDimension(3, 4, [0, 1, 2])).toBe(3);
        expect(timeDimension(null, 4, [0, 1, 2])).toBe(3);
        expect(timeDimension(null, 5, [0, 1, 2])).toBeNull();
        expect(timeDimension(null, 3, [0, 1, 2])).toBeNull();
    });

    test("trackAlignmentMatrix applies the tracks' normalization", () => {
        // splat stored (x, y, z); world axes are the data's (z, y, x)
        const m = trackAlignmentMatrix([10, 20, 30], 100, [2, 1, 0]);
        const e = m.elements; // column-major
        const apply = (p: number[]) =>
            [0, 1, 2].map((r) => e[r] * p[0] + e[4 + r] * p[1] + e[8 + r] * p[2] + e[12 + r]);
        // splat (x=30, y=20, z=10) is the data mean, so it lands at the origin
        expect(apply([30, 20, 10]).map((v) => Math.abs(v) < 1e-12)).toEqual([true, true, true]);
        // +100 in splat z (data z) moves world X by 1
        expect(apply([30, 20, 110])[0]).toBeCloseTo(1);
    });
});
