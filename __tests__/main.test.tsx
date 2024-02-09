import { expect, test, vi } from "vitest";

import Scene from "../src/scene";
import React from "react";
import { render } from "@testing-library/react";

// mock PointCanvas to avoid WebGL errors when testing without a browser
vi.mock("../src/PointCanvas", () => {
    const PointCanvas = vi.fn();
    PointCanvas.prototype.controls = {
        autoRotate: false,
        update: vi.fn(),
    };
    PointCanvas.prototype.points = { id: 42 };
    PointCanvas.prototype.renderer = { domElement: document.createElement("canvas") };

    PointCanvas.prototype.animate = vi.fn();
    PointCanvas.prototype.dispose = vi.fn();
    PointCanvas.prototype.setSize = vi.fn();
    PointCanvas.prototype.resetPointColors = vi.fn();

    return { PointCanvas };
});

test("tests work", () => {
    expect(true).toBeTruthy();
});

test("render Scene", () => {
    const { container } = render(<Scene renderWidth={800} />);
    expect(container).not.toBeNull();
});
