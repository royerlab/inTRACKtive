import { expect, test } from "vitest";

import { PointCanvas } from "../src/lib/PointCanvas.ts";
import Scene from "../src/components/scene";
import { ViewerState } from "../src/lib/ViewerState.ts";
import React from "react";
import { render } from "@testing-library/react";
import { PointsCollection } from "../src/lib/PointSelectionBox.ts";

test("tests work", () => {
    expect(true).toBeTruthy();
});

test("render Scene", () => {
    let canvasState: PointCanvas | null = null;
    const viewerState = new ViewerState();
    const setCanvas = (canvas: PointCanvas) => {
        canvasState = canvas;
    };
    const setSelectedPoints = (selectedPoints: PointsCollection) => {};
    const { container } = render(<Scene
        setCanvas={setCanvas}
        setSelectedPoints={setSelectedPoints}
        loading={false}
        initialViewerState={viewerState}/>);
    expect(container).not.toBeNull();
    expect(canvasState).not.toBeNull();
});
