import { expect, test } from "vitest";

import * as THREE from "three";
import React from "react";
import { render } from "@testing-library/react";

import { usePointCanvas } from "../src/hooks/usePointCanvas";
import Scene from "../src/components/Scene";

test("tests work", () => {
    expect(true).toBeTruthy();
});

test("render Scene", () => {
    const TestContainer = () => {
        const initialViewerState = {
            cameraPosition: new THREE.Vector3(0, 0, 0),
            cameraTarget: new THREE.Vector3(0, 0, 0),
        };

        const sceneDivRef = React.useRef<HTMLDivElement>(null);
        const [_canvas, _dispatchCanvas] = usePointCanvas(sceneDivRef, initialViewerState);

        return <Scene ref={sceneDivRef} loading={false} />;
    };

    const { container } = render(<TestContainer />);
    expect(container).not.toBeNull();
    expect(container.firstChild).not.toBeNull();
    expect(container.firstChild?.firstChild).toBeInstanceOf(HTMLCanvasElement);
});
