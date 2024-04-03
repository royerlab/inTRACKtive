import { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { SelectionHelper } from "three/addons/interactive/SelectionHelper.js";
import { PointSelectionBox, PointsCollection } from "@/lib/PointSelectionBox";

interface SetSelectionCallback {
    (selection: PointsCollection): void;
}

export class PointSelectionBoxHelper {
    canvas: HTMLCanvasElement;
    controls: OrbitControls;
    box: PointSelectionBox;
    helper: SelectionHelper;
    callback: SetSelectionCallback | null = null;
    blocked: boolean = false;

    constructor(scene: Scene, renderer: WebGLRenderer, camera: PerspectiveCamera, controls: OrbitControls) {
        this.controls = controls;
        this.canvas = renderer.domElement;
        this.helper = new SelectionHelper(renderer, "selectBox");
        this.helper.enabled = false;
        this.box = new PointSelectionBox(camera, scene);

        this.canvas.addEventListener("pointerup", this.onPointerUp);
        this.canvas.addEventListener("pointercancel", this.onPointerCancel);
        this.canvas.addEventListener("pointerdown", this.onPointerDown);

        // key listeners are added to the document because we don't want the
        // canvas to have to be selected prior to listening for them
        document.addEventListener("keydown", this.onKeyDown);
        document.addEventListener("keyup", this.onKeyUp);
    }

    onPointerUp = () => {
        console.debug("pointerUp");
        this.blocked = false;
        if (!this.selecting()) return;
        this.updateSelectedPoints();
    };

    onPointerCancel = () => {
        this.blocked = false;
    };

    onPointerDown = () => {
        this.blocked = true;
    };

    onKeyDown = (event: KeyboardEvent) => {
        console.debug("keyDown: %s", event.key);
        // ignore repeats (key held down)
        if (event.repeat) {
            return;
        }
        if (event.key === "Shift") {
            this.setSelecting(true);
        }
    };

    onKeyUp = (event: KeyboardEvent) => {
        console.debug("onKeyUp: %s", event.key);
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
        if (this.callback) {
            this.callback(selectedPoints);
        }
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
        this.canvas.removeEventListener("pointerup", this.onPointerUp);
        this.canvas.removeEventListener("pointercancel", this.onPointerCancel);
        this.canvas.removeEventListener("pointerdown", this.onPointerDown);

        document.removeEventListener("keydown", this.onKeyDown);
        document.removeEventListener("keyup", this.onKeyUp);

        this.helper.dispose();
    }
}
