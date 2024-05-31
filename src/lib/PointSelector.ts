import { PerspectiveCamera, Points, Scene, WebGLRenderer } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { PointsCollection } from "@/lib/PointSelectionBox";
import { BoxPointSelector } from "./BoxPointSelector";
import { SpherePointSelector } from "./SpherePointSelector";

export enum PointSelectionMode {
    BOX = "BOX",
    SPHERICAL_CURSOR = "SPHERICAL_CURSOR",
    SPHERE = "SPHERE",
}

interface PointSelectorInterface {
    keyDown(event: KeyboardEvent): void;
    keyUp(event: KeyboardEvent): void;
    mouseWheel(event: WheelEvent): void;
    pointerMove(event: MouseEvent): void;
    pointerUp(event: MouseEvent): void;
    pointerDown(event: MouseEvent): void;
    pointerCancel(event: MouseEvent): void;
    dispose(): void;
}

export type SelectionChanged = (selection: PointsCollection) => void;

// this is a separate class to keep the point selection logic separate from the rendering logic in
// the PointCanvas class this fixes some issues with callbacks and event listeners binding to
// the original instance of the class, though we make many (shallow) copies of the PointCanvas
// to update state in the app
export class PointSelector {
    readonly canvas: HTMLCanvasElement;
    readonly boxSelector: BoxPointSelector;
    readonly sphereSelector: SpherePointSelector;

    selectionMode: PointSelectionMode = PointSelectionMode.BOX;
    selection: PointsCollection = new Map();
    // To optionally notify external observers about changes to the current selection.
    selectionChanged: SelectionChanged = (_selection: PointsCollection) => {};

    constructor(
        scene: Scene,
        renderer: WebGLRenderer,
        camera: PerspectiveCamera,
        controls: OrbitControls,
        points: Points,
    ) {
        this.boxSelector = new BoxPointSelector(scene, renderer, camera, controls, this.setSelectedPoints.bind(this));
        this.sphereSelector = new SpherePointSelector(
            scene,
            renderer,
            camera,
            controls,
            points,
            this.setSelectedPoints.bind(this),
        );

        this.canvas = renderer.domElement;
        this.canvas.addEventListener("pointermove", this);
        this.canvas.addEventListener("pointerup", this);
        this.canvas.addEventListener("pointerdown", this);
        this.canvas.addEventListener("pointercancel", this);
        this.canvas.addEventListener("wheel", this);
        // Key listeners are added to the document because we don't want the
        // canvas to have to be selected prior to listening for them
        document.addEventListener("keydown", this);
        document.addEventListener("keyup", this);
    }

    dispose() {
        this.canvas.removeEventListener("pointermove", this);
        this.canvas.removeEventListener("pointerup", this);
        this.canvas.removeEventListener("pointerdown", this);
        this.canvas.removeEventListener("pointercancel", this);
        this.canvas.removeEventListener("wheel", this);
        document.removeEventListener("keydown", this);
        document.removeEventListener("keyup", this);

        this.boxSelector.dispose();
        this.sphereSelector.dispose();
    }

    selector(): PointSelectorInterface {
        return this.selectionMode === PointSelectionMode.BOX ? this.boxSelector : this.sphereSelector;
    }

    setSelectedPoints(selection: PointsCollection) {
        console.debug("PointSelector.setSelectedPoints:", selection);
        this.selection = selection;
        this.selectionChanged(selection);
    }

    setSelectionMode(mode: PointSelectionMode) {
        console.debug("PointSelector.setSelectionMode: ", mode);
        this.selectionMode = mode;
        this.sphereSelector.setVisible(mode !== PointSelectionMode.BOX, mode === PointSelectionMode.SPHERE);
    }

    handleEvent(event: Event) {
        const selector = this.selector();
        switch (event.type) {
            case "pointermove":
                selector.pointerMove(event as MouseEvent);
                break;
            case "pointerup":
                selector.pointerUp(event as MouseEvent);
                break;
            case "pointerdown":
                selector.pointerDown(event as MouseEvent);
                break;
            case "pointercancel":
                selector.pointerCancel(event as MouseEvent);
                break;
            case "wheel":
                selector.mouseWheel(event as WheelEvent);
                break;
            case "keydown":
                selector.keyDown(event as KeyboardEvent);
                break;
            case "keyup":
                selector.keyUp(event as KeyboardEvent);
                break;
        }
    }
}
