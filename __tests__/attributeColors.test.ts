import { describe, expect, test } from "vitest";

import { composeRgbAttributes, RGB_BACKGROUND, selectRgbAttributes } from "../src/lib/AttributeColors";

const expectColors = (colors: Float32Array, expected: number[]) => {
    expect(colors).toHaveLength(expected.length);
    expected.forEach((value, index) => expect(colors[index]).toBeCloseTo(value));
};

describe("selectRgbAttributes", () => {
    test("preserves channel slots while rejecting invalid and duplicate features", () => {
        const red = { label: 8, type: "continuous", name: "red" };
        const selected = selectRgbAttributes([
            red,
            null,
            { label: 7, type: "continuous", name: "blue" },
            { label: 9, type: "continuous", name: "too many" },
        ]);
        const invalid = selectRgbAttributes([
            red,
            { label: 4, type: "categorical", name: "ignored" },
            { ...red, name: "duplicate" },
        ]);

        expect(selected.map((option) => option?.name ?? null)).toEqual(["red", null, "blue"]);
        expect(invalid).toEqual([red, null, null]);
    });
});

describe("composeRgbAttributes", () => {
    test("assigns features to red, green, and blue in channel order", () => {
        const colors = composeRgbAttributes(
            [new Float32Array([0, 10]), new Float32Array([4, 2]), new Float32Array([7, 7])],
            [false, false, false],
            2,
            1,
        );

        expectColors(colors, [RGB_BACKGROUND, 1, 1, 1, RGB_BACKGROUND, 1]);
    });

    test("keeps missing channels dim gray and applies brightness", () => {
        const colors = composeRgbAttributes([new Float32Array([0.25, 1])], [true], 2, 0.5);

        expectColors(colors, [0.125, RGB_BACKGROUND * 0.5, RGB_BACKGROUND * 0.5, 0.5, 0.04, 0.04]);
    });

    test("shows cells as dim gray even when no feature has color", () => {
        const colors = composeRgbAttributes([], [], 2, 1);

        expectColors(colors, new Array(6).fill(RGB_BACKGROUND));
    });

    test("clamps pre-normalized values and treats non-finite values as gray", () => {
        const colors = composeRgbAttributes(
            [new Float32Array([-1, 2, Number.NaN]), new Float32Array([0, 0.5, 1])],
            [true, true],
            3,
            1,
        );

        expectColors(colors, [0.08, 0.08, 0.08, 1, 0.5, 0.08, 0.08, 1, 0.08]);
    });

    test("uses at most three attributes", () => {
        const colors = composeRgbAttributes(
            [new Float32Array([1]), new Float32Array([1]), new Float32Array([1]), new Float32Array([0])],
            [true, true, true, true],
            1,
            1,
        );

        expectColors(colors, [1, 1, 1]);
    });
});
