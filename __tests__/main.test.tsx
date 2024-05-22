import { expect, test } from "vitest";

import { Vector3 } from "three";
import React from "react";
import { render } from "@testing-library/react";

import { usePointCanvas } from "../src/hooks/usePointCanvas";
import { PointCanvas } from "../src/lib/PointCanvas";
import Scene from "../src/components/Scene";

test("tests work", () => {
    expect(true).toBeTruthy();
});

test("render Scene", () => {
    const TestContainer = () => {
        const initialViewerState = {
            cameraPosition: new Vector3(0, 0, 0),
            cameraTarget: new Vector3(0, 0, 0),
        };
        const [canvas, _dispatcher, ref] = usePointCanvas(initialViewerState);

        expect(canvas).toBeInstanceOf(PointCanvas);

        return <Scene ref={ref} loading={false} />;
    };

    const { container } = render(<TestContainer />);
    expect(container).not.toBeNull();
    expect(container.firstChild).not.toBeNull();
    expect(container.firstChild?.firstChild).toBeInstanceOf(HTMLCanvasElement);
});
