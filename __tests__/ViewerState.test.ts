import { expect, test } from "vitest";

import { ViewerState } from "../src/lib/ViewerState";
import { Vector3 } from "three";

test("(de)serialize ViewerState", () => {
    const state = new ViewerState(
        "https://test.com/data/tracks.zarr", // dataUrl
        5, // curTime
        new Vector3(-0.5, 1, 2.5), // cameraPosition
        new Vector3(1, 2, 3), // cameraTarget
        new Map([[1, [2, 3, 4]]]), // selectedPoints
    );

    const hash = state.toUrlHash();
    const revivedState = ViewerState.fromUrlHash(hash);

    expect(revivedState).toEqual(state);
});
