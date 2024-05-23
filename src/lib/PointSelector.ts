import {
    PerspectiveCamera,
    Points,
    Scene,
    WebGLRenderer,
} from "three";
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
    keyDown(event: KeyboardEvent) : void;
    keyUp(event: KeyboardEvent) : void;
    mouseWheel(event: WheelEvent) : void;
    pointerMove(event: MouseEvent) : void;
    pointerUp(event: MouseEvent) : void;
    pointerDown(event: MouseEvent) : void;
    pointerCancel(event: MouseEvent) : void;
    dispose() : void;
};

export type SelectionChanged = (selection: PointsCollection) => void;

// this is a separate class to keep the point selection logic separate from the rendering logic in
// the PointCanvas class this fixes some issues with callbacks and event listeners binding to
// the original instance of the class, though we make many (shallow) copies of the PointCanvas
// to update state in the app
export class PointSelector {
    renderer: WebGLRenderer;
    boxSelector: BoxPointSelector | null = null;
    sphereSelector: SpherePointSelector | null = null;

    selectionMode: PointSelectionMode = PointSelectionMode.BOX;
    selection: PointsCollection = new Map();
    // To optionally notify external observers about changes to the current selection.
    selectionChanged: SelectionChanged | null = null;

    constructor(renderer: WebGLRenderer) {
        // TODO: constructor is not really needed except it means that renderer is non-null.
        this.renderer = renderer;
    }

    init(
        scene: Scene,
        renderer: WebGLRenderer,
        camera: PerspectiveCamera,
        controls: OrbitControls,
        points: Points,
    ) {
        if (this.boxSelector) {
            this.boxSelector.dispose();
        }
        if (this.sphereSelector) {
            this.sphereSelector.dispose();
        }
        this.boxSelector = new BoxPointSelector(scene, renderer, camera, controls, this.setSelectedPoints.bind(this));
        this.sphereSelector = new SpherePointSelector(scene, renderer, camera, controls, points, this.setSelectedPoints.bind(this));

        this.renderer = renderer;
        this.renderer.domElement.addEventListener("pointermove", this);
        this.renderer.domElement.addEventListener("pointerup", this);
        this.renderer.domElement.addEventListener("pointerdown", this);
        this.renderer.domElement.addEventListener("pointercancel", this);
        this.renderer.domElement.addEventListener("wheel", this);
        // Key listeners are added to the document because we don't want the
        // canvas to have to be selected prior to listening for them
        document.addEventListener("keydown", this);
        document.addEventListener("keyup", this);
    }

    dispose() {
        this.renderer.domElement.removeEventListener("pointermove", this);
        this.renderer.domElement.removeEventListener("pointerup", this);
        this.renderer.domElement.removeEventListener("pointerdown", this);
        this.renderer.domElement.removeEventListener("pointercancel", this);
        this.renderer.domElement.removeEventListener("wheel", this);
        document.removeEventListener("keydown", this);
        document.removeEventListener("keyup", this);
 
        if (this.boxSelector) {
            this.boxSelector.dispose();
        }
        if (this.sphereSelector) {
            this.sphereSelector.dispose();
        }
    }

    selector() : PointSelectorInterface | null {
        return this.selectionMode === PointSelectionMode.BOX ? this.boxSelector : this.sphereSelector;
    }

    setSelectedPoints(selection: PointsCollection) {
        console.debug("PointSelector.setSelectedPoints:", selection);
        this.selection = selection;
        if (this.selectionChanged) {
            this.selectionChanged(selection);
        }
    }

    setSelectionMode(mode: PointSelectionMode) {
        console.debug("PointSelector.setSelectionMode: ", mode);
        this.selectionMode = mode;
        if (this.sphereSelector) {
            this.sphereSelector.setVisible(mode !== PointSelectionMode.BOX, mode === PointSelectionMode.SPHERE);
        }
    }

    handleEvent(event: Event) {
        const selector = this.selector();
        if (!selector) return;
        switch (event.type) {
            case "pointermove":
                selector.pointerMove(event as MouseEvent);
                break;
            case "pointerup":
                selector.pointerUp(event as MouseEvent);
                break
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