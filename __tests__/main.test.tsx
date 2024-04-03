import { expect, test } from "vitest";

import { PointCanvas } from "../src/lib/PointCanvas.ts";
import Scene from "../src/components/scene";
import React from "react";
import { render } from "@testing-library/react";

test("tests work", () => {
    expect(true).toBeTruthy();
});

test("render Scene", () => {
    let canvasState: PointCanvas | null = null;
    const setCanvas = (canvas: PointCanvas) => {
        canvasState = canvas;
    };
    const { container } = render(<Scene setCanvas={setCanvas} loading={false} />);
    expect(container).not.toBeNull();
    expect(canvasState).not.toBeNull();
});
