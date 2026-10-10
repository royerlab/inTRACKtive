import { describe, expect, test } from "vitest";

import { Option } from "../src/lib/TrackManager";
import { ViewerState } from "../src/lib/ViewerState";

const continuousOption = (name: string, label: number): Option => ({
    name,
    label,
    type: "continuous",
    action: "provided",
    numCategorical: undefined,
});

describe("ViewerState RGB features", () => {
    test("round-trips the ordered feature selection", () => {
        const state = new ViewerState();
        state.multiColorBy = true;
        state.colorByEvents = [continuousOption("first", 6), null, continuousOption("third", 7)];

        const restored = ViewerState.fromUrlHash(state.toUrlHash());

        expect(restored).toBeInstanceOf(ViewerState);
        expect(restored.multiColorBy).toBe(true);
        expect(restored.colorByEvents.map((option) => option?.name ?? null)).toEqual(["first", null, "third"]);
    });

    test("supplies RGB defaults for links created before multi-color mode", () => {
        const oldState = new URLSearchParams();
        oldState.append("viewerState", JSON.stringify({ colorBy: true }));

        const restored = ViewerState.fromUrlHash(`#${oldState.toString()}`);

        expect(restored.multiColorBy).toBe(false);
        expect(restored.colorByEvents).toEqual([]);
    });
});
