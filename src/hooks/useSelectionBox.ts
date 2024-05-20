import { SelectionHelper } from "three/addons/interactive/SelectionHelper.js";
import { useEffect, useRef, useState } from "react";

import { PointSelectionBox, PointsCollection } from "@/lib/PointSelectionBox";
import { PointCanvas } from "@/lib/PointCanvas";

export default function useSelectionBox(canvas: PointCanvas | null) {
    const [initialized, setInitialized] = useState(false);
    const [selecting, setSelecting] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState<PointsCollection>();

    const selectionBox = useRef<PointSelectionBox>();
    const selectionHelper = useRef<SelectionHelper>();

    useEffect(() => {
        if (!canvas) {
            console.debug("canvas is undefined - deferring useSelectionBox setup");
            return;
        }
        if (initialized) return;
        setInitialized(true);
        console.log("useSelectionBox setup: %s", canvas);
        // Point selection
        selectionHelper.current = new SelectionHelper(canvas.renderer, "selectBox");
        selectionHelper.current.enabled = false;
        selectionBox.current = new PointSelectionBox(canvas.camera, canvas.scene);

        let pointerUp: () => void;
        if (selectionBox.current && selectionHelper.current) {
            const sBox = selectionBox.current;
            const sHelper = selectionHelper.current;
            pointerUp = () => {
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
        }
        const keyDown = (event: KeyboardEvent) => {
            console.debug("SelectionBox keyDown: %s", event.key);
            if (event.repeat) {
                return;
            } // ignore repeats (key held down)
            if (event.key === "Shift") {
                setSelecting(true);
            }
        };
        const keyUp = (event: KeyboardEvent) => {
            console.debug("SelectionBox keyUp: %s", event.key);
            if (event.key === "Shift") {
                setSelecting(false);
            }
        };

        // key listeners are added to the document because we don't want the
        // canvas to have to be selected prior to listening for them
        document.addEventListener("keydown", keyDown);
        document.addEventListener("keyup", keyUp);

        // we actually *don't* want to remove the event listeners here because this gets called when
        // the canvas is re-rendered, and we want to keep the event listeners active
        // TODO: this could be cleaned up in a selection refactor
    }, [canvas]);

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
