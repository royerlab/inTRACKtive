import { PerspectiveCamera, Points, Scene, WebGLRenderer } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SelectionHelper } from "three/addons/interactive/SelectionHelper.js";

import { PointSelectionBox } from "@/lib/PointSelectionBox";
import { SelectionChanged } from "@/lib/PointSelector";

// Selection with a 2D rectangle to make a 3D frustum.
export class BoxPointSelector {
    readonly renderer: WebGLRenderer;
    readonly controls: OrbitControls;
    readonly box: PointSelectionBox;
    readonly helper: SelectionHelper;
    readonly points: Points;
    readonly selectionChanged: SelectionChanged;

    // True if this should not perform selection, false otherwise.
    // Used for blocking selections when pointer is held down before
    // entering the canvas.
    blocked: boolean = false;

    constructor(
        scene: Scene,
        renderer: WebGLRenderer,
        camera: PerspectiveCamera,
        controls: OrbitControls,
        points: Points,
        selectionChanged: SelectionChanged,
    ) {
        this.renderer = renderer;
        this.controls = controls;
        this.points = points;
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

        this.selectionChanged(this.box.collection.get(this.points.id) ?? []);
    }

    pointerCancel(_event: MouseEvent) {
        console.debug("BoxPointSelector.pointerCancel");
        this.blocked = false;
    }

    pointerDown(_event: MouseEvent) {
        console.debug("BoxPointSelector.pointerDown");
        this.blocked = true;
    }

    keyDown(event: KeyboardEvent) {
        console.debug("BoxPointSelector.keyDown: ", event.key);
        // ignore repeats (key held down)
        if (event.repeat) {
            return;
        }
        if (event.key === "Shift") {
            this.helper.enabled = false; // Ensure helper starts disabled
            this.helper.element.style.display = "none"; // Hide any visible rectangle
            this.helper.startPoint.set(0, 0); // Reset the start point
            this.helper.pointTopLeft.set(0, 0); // Reset the top-left point
            this.helper.pointBottomRight.set(0, 0); // Reset the bottom-right point
            this.helper.isDown = false; // Explicitly tell helper no drag is in progress (this was key to solving the shift issue)
            this.setSelecting(true);
        }
    }

    keyUp(event: KeyboardEvent) {
        console.debug("BoxPointSelector.keyUp: %s", event.key);
        if (event.key === "Shift") {
            // ignore if helper is already disabled
            if (!this.helper.enabled) {
                return;
            }

            this.setSelecting(false);
            this.helper.enabled = false;
            this.helper.element.style.display = "none";
            this.controls.enabled = true;

            // If mouse is still down, block future selections
            if (this.selecting()) {
                this.blocked = true;
            }
        }
    }

    mouseWheel(_event: WheelEvent) {}

    pointerMove(_event: MouseEvent) {}
}
