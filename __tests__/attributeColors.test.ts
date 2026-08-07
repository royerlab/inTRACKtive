import { describe, expect, test } from "vitest";

import { composeRgbAttributes, selectRgbAttributes } from "../src/lib/AttributeColors";

describe("selectRgbAttributes", () => {
    test("keeps unique continuous features in user selection order and limits them to three", () => {
        const selected = selectRgbAttributes([
            { label: 4, type: "categorical", name: "ignored" },
            { label: 8, type: "continuous", name: "red" },
            { label: 7, type: "continuous", name: "green" },
            { label: 8, type: "continuous", name: "duplicate" },
            { label: 9, type: "continuous", name: "blue" },
            { label: 10, type: "continuous", name: "too many" },
        ]);

        expect(selected.map((option) => option.name)).toEqual(["red", "green", "blue"]);
    });
});

describe("composeRgbAttributes", () => {
    test("assigns features to red, green, and blue in selection order", () => {
        const colors = composeRgbAttributes(
            [new Float32Array([0, 10]), new Float32Array([4, 2]), new Float32Array([7, 7])],
            [false, false, false],
            2,
            1,
        );

        expect(Array.from(colors)).toEqual([0, 1, 1, 1, 0, 1]);
    });

    test("keeps missing channels at zero and applies brightness", () => {
        const colors = composeRgbAttributes([new Float32Array([0.25, 1])], [true], 2, 0.5);

        expect(Array.from(colors)).toEqual([0.125, 0, 0, 0.5, 0, 0]);
    });

    test("clamps pre-normalized values and treats non-finite values as zero", () => {
        const colors = composeRgbAttributes(
            [new Float32Array([-1, 2, Number.NaN]), new Float32Array([0, 0.5, 1])],
            [true, true],
            3,
            1,
        );

        expect(Array.from(colors)).toEqual([0, 0, 0, 1, 0.5, 0, 0, 1, 0]);
    });

    test("uses at most three attributes", () => {
        const colors = composeRgbAttributes(
            [new Float32Array([1]), new Float32Array([1]), new Float32Array([1]), new Float32Array([0])],
            [true, true, true, true],
            1,
            1,
        );

        expect(Array.from(colors)).toEqual([1, 1, 1]);
    });
});
