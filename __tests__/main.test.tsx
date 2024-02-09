import { expect, test, vi } from "vitest";

import Scene from "../src/scene";
import React from "react";
import { render } from "@testing-library/react";

// mock PointCanvas to avoid WebGL errors when testing without a browser
vi.mock("../src/PointCanvas", () => {
    const PointCanvas = vi.fn();
    PointCanvas.prototype.renderer = {
        domElement: document.createElement("canvas"),
    };
    PointCanvas.prototype.controls = {
        autoRotate: false,
        update: vi.fn(),
    };
    PointCanvas.prototype.animate = vi.fn();
    PointCanvas.prototype.setSize = vi.fn();
    return { PointCanvas };
});

test("tests work", () => {
    expect(true).toBeTruthy();
});

test("render Scene", () => {
    const { container } = render(<Scene renderWidth={800} />);
    expect(container).not.toBeNull();
});
