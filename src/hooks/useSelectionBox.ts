import { SelectionHelper } from "three/addons/interactive/SelectionHelper.js";
import { useEffect, useRef, useState } from "react";

import { PointSelectionBox, PointsCollection } from "@/lib/PointSelectionBox";
import { PointCanvas, PointSelectionMode } from "@/lib/PointCanvas";

export default function useSelectionBox(canvas: PointCanvas) {
    const [selecting, setSelecting] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState<PointsCollection>();

    const selectionBox = useRef<PointSelectionBox>();
    const selectionHelper = useRef<SelectionHelper>();

    useEffect(() => {
        console.log("useSelectionBox setup: %s", canvas);
        // Point selection
        selectionHelper.current = new SelectionHelper(canvas.renderer, "selectBox");
        selectionHelper.current.enabled = false;
        selectionBox.current = new PointSelectionBox(canvas.camera, canvas.scene);

        const sBox = selectionBox.current;
        const sHelper = selectionHelper.current;
        const pointerUp = () => {
            if (canvas.selector.selectionMode !== PointSelectionMode.BOX) {
                return;
            }
            console.debug("SelectionBox pointerUp: %s", sHelper.enabled);
            if (sHelper.enabled) {
                // Mouse to normalized render/canvas coords from:
                // https://codepen.io/boytchev/pen/NWOMrxW?editors=0011
                const canvasElement = canvas.renderer.domElement.getBoundingClientRect();

                const topLeft = sHelper.pointTopLeft;
                const left = ((topLeft.x - canvasElement.left) / canvasElement.width) * 2 - 1;
                const top = (-(topLeft.y - canvasElement.top) / canvasElement.height) * 2 + 1;

                const bottomRight = sHelper.pointBottomRight;
                const right = ((bottomRight.x - canvasElement.left) / canvasElement.width) * 2 - 1;
                const bottom = (-(bottomRight.y - canvasElement.top) / canvasElement.height) * 2 + 1;
                console.debug(
                    "selectionHelper, top = %f, left = %f, bottom = %f, right = %f",
                    top,
                    left,
                    bottom,
                    right,
                );

                // TODO: check the z-value of these points
                sBox.startPoint.set(left, top, 0.5);
                sBox.endPoint.set(right, bottom, 0.5);

                // TODO: consider restricting selection to a specific object
                const selection = sBox.select();
                setSelectedPoints(selection);
                console.debug("selected points:", selection);
            }
        };
        // TODO: improve the behavior when pressing/releasing the mouse and
        // shift key in different orders
        canvas.renderer.domElement.addEventListener("pointerup", pointerUp);

        const keyDown = (event: KeyboardEvent) => {
            console.debug("SelectionBox keyDown: %s", event.key);
            if (event.repeat) {
                return;
            } // ignore repeats (key held down)
            if (event.key === "Shift" && canvas.selector.selectionMode === PointSelectionMode.BOX) {
                setSelecting(true);
            }
        };
        const keyUp = (event: KeyboardEvent) => {
            console.debug("SelectionBox keyUp: %s", event.key);
            if (event.key === "Shift" && canvas.selector.selectionMode === PointSelectionMode.BOX) {
                setSelecting(false);
            }
        };

        // key listeners are added to the document because we don't want the
        // canvas to have to be selected prior to listening for them
        document.addEventListener("keydown", keyDown);
        document.addEventListener("keyup", keyUp);

        return () => {
            selectionHelper.current?.dispose();
            canvas.renderer.domElement.removeEventListener("pointerup", pointerUp);
            document.removeEventListener("keydown", keyDown);
            document.removeEventListener("keyup", keyUp);
        };
    }, []);

    useEffect(() => {
        if (selectionHelper.current) {
            selectionHelper.current.enabled = selecting;
        }
        if (canvas) {
            canvas.controls.enabled = !selecting;
        }
    }, [selecting]);

    return { selectedPoints, setSelectedPoints, selecting, setSelecting };
}
