import { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SelectionHelper } from "three/addons/interactive/SelectionHelper.js";

import { PointSelectionBox, PointsCollection } from "@/lib/PointSelectionBox";
import { SelectionChanged } from "@/lib/PointSelector";


// Selection with a rectangle.
export class BoxPointSelector {
    renderer: WebGLRenderer;
    controls: OrbitControls;
    box: PointSelectionBox;
    helper: SelectionHelper;
    selectionChanged: SelectionChanged;
    blocked: boolean = false;

    constructor(scene: Scene, renderer: WebGLRenderer, camera: PerspectiveCamera, controls: OrbitControls, selectionChanged: SelectionChanged) {
        this.renderer = renderer;
        this.controls = controls;
        this.helper = new SelectionHelper(renderer, "selectBox");
        this.helper.enabled = false;
        this.box = new PointSelectionBox(camera, scene);
        this.selectionChanged = selectionChanged;
    }

    dispose() {
        this.helper.dispose();
    }

    selecting(): boolean {
        return this.helper.enabled;
    }

    setSelecting(selecting: boolean) {
        console.debug("BoxPointSelector.setSelecting: ", selecting);
        if (!this.blocked) {
            this.helper.enabled = selecting;
            this.controls.enabled = !selecting;
        }
    }

    setSelectedPoints(selectedPoints: PointsCollection) {
        console.debug("BoxPointSelector.setSelectedPoints: ", selectedPoints);
        this.box.collection = selectedPoints;
        this.selectionChanged(selectedPoints);
    }

    pointerUp(_event: MouseEvent) {
        console.debug("BoxPointSelector.pointerUp");
        this.blocked = false;
        if (!this.selecting()) return;
        // Mouse to normalized render/canvas coords from:
        // https://codepen.io/boytchev/pen/NWOMrxW?editors=0011
        const canvasRect = this.renderer.domElement.getBoundingClientRect();

        const topLeft = this.helper.pointTopLeft;
        const left = ((topLeft.x - canvasRect.left) / canvasRect.width) * 2 - 1;
        const top = (-(topLeft.y - canvasRect.top) / canvasRect.height) * 2 + 1;

        const bottomRight = this.helper.pointBottomRight;
        const right = ((bottomRight.x - canvasRect.left) / canvasRect.width) * 2 - 1;
        const bottom = (-(bottomRight.y - canvasRect.top) / canvasRect.height) * 2 + 1;
        console.debug("updateSelectedPoints, top = %f, left = %f, bottom = %f, right = %f", top, left, bottom, right);

        // TODO: check the z-value of these points
        this.box.startPoint.set(left, top, 0.5);
        this.box.endPoint.set(right, bottom, 0.5);
        // TODO: consider restricting selection to a specific object
        this.box.select();

        this.setSelectedPoints(this.box.collection);
    };

    pointerCancel(_event: MouseEvent) {
        console.debug("BoxPointSelector.pointerCancel");
        this.blocked = false;
    };

    pointerDown(_event: MouseEvent) {
        console.debug("BoxPointSelector.pointerDown");
        this.blocked = true;
    };

    keyDown(event: KeyboardEvent) {
        console.debug("BoxPointSelector.keyDown: ", event.key);
        // ignore repeats (key held down)
        if (event.repeat) {
            return;
        }
        if (event.key === "Shift") {
            this.setSelecting(true);
        }
    };

    keyUp(event: KeyboardEvent) {
        console.debug("BoxPointSelector.keyUp: %s", event.key);
        if (event.key === "Shift") {
            this.setSelecting(false);
        }
    };

    mouseWheel(_event: WheelEvent) {}

    pointerMove(_event: MouseEvent) {}
}