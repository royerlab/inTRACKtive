import { expect, test } from "vitest";

import { PointCanvas } from "../src/lib/PointCanvas.ts";
import Scene from "../src/components/scene";
import React from "react";
import { render } from "@testing-library/react";

test("tests work", () => {
    expect(true).toBeTruthy();
});

test("render Scene", () => {
    const canvasRef = {
        current: new PointCanvas(800, 600),
    };
    const { container } = render(<Scene canvas={canvasRef} loading={false} />);
    expect(container).not.toBeNull();
});
