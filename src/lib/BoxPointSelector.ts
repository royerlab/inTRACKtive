import { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SelectionHelper } from "three/addons/interactive/SelectionHelper.js";

import { PointSelectionBox, PointsCollection } from "@/lib/PointSelectionBox";
import { SelectionChanged } from "@/lib/PointSelector";


// Selection with a rectangle.
export class BoxPointSelector {
    canvas: HTMLCanvasElement;
    controls: OrbitControls;
    box: PointSelectionBox;
    helper: SelectionHelper;
    selectionChanged: SelectionChanged;
    blocked: boolean = false;

    constructor(scene: Scene, renderer: WebGLRenderer, camera: PerspectiveCamera, controls: OrbitControls, selectionChanged: SelectionChanged) {
        this.controls = controls;
        this.canvas = renderer.domElement;
        this.helper = new SelectionHelper(renderer, "selectBox");
        this.helper.enabled = false;
        this.box = new PointSelectionBox(camera, scene);
        this.selectionChanged = selectionChanged;
    }

    mouseWheel(_event: WheelEvent) {}

    pointerMove(_event: MouseEvent) {}

    pointerUp(_event: MouseEvent) {
        console.debug("BoxPointSelector.pointerUp");
        this.blocked = false;
        if (!this.selecting()) return;
        this.updateSelectedPoints();
    };

    pointerCancel(_event: MouseEvent) {
        this.blocked = false;
    };

    pointerDown(_event: MouseEvent) {
        this.blocked = true;
    };

    keyDown(event: KeyboardEvent) {
        console.debug("BoxPointSelector.keyDown: %s", event.key);
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

    selecting(): boolean {
        return this.helper.enabled;
    }

    setSelecting(selecting: boolean) {
        if (!this.blocked) {
            this.helper.enabled = selecting;
            this.controls.enabled = !selecting;
        }
    }

    selectedPoints(): PointsCollection {
        return this.box.collection;
    }

    setSelectedPoints(selectedPoints: PointsCollection) {
        console.debug("setSelectedPoints: ", selectedPoints);
        this.box.collection = selectedPoints;
        this.selectionChanged(selectedPoints);
    }

    updateSelectedPoints() {
        // Mouse to normalized render/canvas coords from:
        // https://codepen.io/boytchev/pen/NWOMrxW?editors=0011
        const canvasRect = this.canvas.getBoundingClientRect();

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
    }

    dispose() {
        this.helper.dispose();
    }
}