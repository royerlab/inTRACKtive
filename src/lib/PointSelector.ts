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

let nextObjectId: number = 1;

// this is a separate class to keep the point selection logic separate from the rendering logic in
// the PointCanvas class this fixes some issues with callbacks and event listeners binding to
// the original instance of the class, though we make many (shallow) copies of the PointCanvas
// to update state in the app
export class PointSelector {
    objectId: number;

    boxSelector: BoxPointSelector;
    sphereSelector: SpherePointSelector;
    htmlCanvas: HTMLCanvasElement;

    // Current selection mode.
    selectionMode: PointSelectionMode = PointSelectionMode.BOX;

    // Current selection.
    selection: PointsCollection;

    // Selection change callback.
    selectionChangedCallback: SelectionChanged | null = null;

    constructor(
        scene: Scene,
        renderer: WebGLRenderer,
        camera: PerspectiveCamera,
        controls: OrbitControls,
        points: Points,
    ) {
        this.objectId = nextObjectId;
        nextObjectId += 1;
        this.selection = new Map();
        this.boxSelector = new BoxPointSelector(scene, renderer, camera, controls, this.setSelectedPoints);
        this.sphereSelector = new SpherePointSelector(scene, renderer, camera, controls, points, this.setSelectedPoints);

        this.htmlCanvas = renderer.domElement;
        console.debug("PointerSelector.htmlCanvas: ", this.htmlCanvas);
    }

    setCallback(callback: SelectionChanged) {
        console.debug("PointSelector.setCallback: ", callback, this.objectId);
        this.selectionChangedCallback = callback;
    }

    addEventListeners() {
        // handle event
        this.htmlCanvas.addEventListener("pointermove", this);
        this.htmlCanvas.addEventListener("pointerup", this);
        this.htmlCanvas.addEventListener("pointerdown", this);
        this.htmlCanvas.addEventListener("pointercancel", this);
        this.htmlCanvas.addEventListener("wheel", this);
        // Key listeners are added to the document because we don't want the
        // canvas to have to be selected prior to listening for them
        document.addEventListener("keydown", this);
        document.addEventListener("keyup", this);
 
        // // bind approach
        // this.pointerMove = this.pointerMove.bind(this);
        // this.htmlCanvas.addEventListener("pointermove", this.pointerMove);
        // this.pointerUp = this.pointerUp.bind(this);
        // this.htmlCanvas.addEventListener("pointerup", this.pointerUp);
        // this.pointerDown = this.pointerDown.bind(this);
        // this.htmlCanvas.addEventListener("pointerdown", this.pointerDown);
        // this.pointerCancel = this.pointerCancel.bind(this);
        // this.htmlCanvas.addEventListener("pointercancel", this.pointerCancel);
        // this.mouseWheel = this.mouseWheel.bind(this);
        // this.htmlCanvas.addEventListener("wheel", this.mouseWheel);
        // // Key listeners are added to the document because we don't want the
        // // canvas to have to be selected prior to listening for them
        // this.keyDown = this.keyDown.bind(this);
        // document.addEventListener("keydown", this.keyDown);
        // this.keyUp = this.keyUp.bind(this);
        // document.addEventListener("keyup", this.keyUp);
    }

    handleEvent(event: Event) {
        // console.debug("PointSelector.handleEvent: ", event, this.selectionMode);
        switch (event.type) {
            case "pointermove":
                this.selector().pointerMove(event as MouseEvent);
                break;
            case "pointerup":
                this.selector().pointerUp(event as MouseEvent);
                break
            case "pointerdown":
                this.selector().pointerDown(event as MouseEvent);
                break;
            case "pointercancel":
                this.selector().pointerCancel(event as MouseEvent);
                break;
            case "wheel":
                this.selector().mouseWheel(event as WheelEvent);
                break;
            case "keydown":
                this.selector().keyDown(event as KeyboardEvent);
                break;
            case "keyup":
                this.selector().keyUp(event as KeyboardEvent);
                break;
        }
    }

    keyDown(event: KeyboardEvent) {
        console.debug("PointSelector.keyDown", event);
        this.selector().keyDown(event);
    };

    keyUp(event: KeyboardEvent)
    {
        this.selector().keyUp(event);
    };

    mouseWheel(event: WheelEvent) {
        this.selector().mouseWheel(event);
    };

    pointerMove(event: MouseEvent) {
        this.selector().pointerMove(event);
    };

    pointerUp(event: MouseEvent) {
        console.debug("PointSelector.pointerUp", event);
        this.selector().pointerUp(event);
    };

    pointerDown(event: MouseEvent) {
        this.selector().pointerDown(event);
    };

    pointerCancel(event: MouseEvent) {
        this.selector().pointerCancel(event);
    };

    selector() : PointSelectorInterface {
        return this.selectionMode === PointSelectionMode.BOX ? this.boxSelector : this.sphereSelector;
    }

    dispose() {
        // using handleEvent
        this.htmlCanvas.removeEventListener("pointermove", this);
        this.htmlCanvas.removeEventListener("pointerup", this);
        this.htmlCanvas.removeEventListener("pointerdown", this);
        this.htmlCanvas.removeEventListener("pointercancel", this);
        this.htmlCanvas.removeEventListener("wheel", this);
        // Key listeners are added to the document because we don't want the
        // canvas to have to be selected prior to listening for them
        document.removeEventListener("keydown", this);
        document.removeEventListener("keyup", this);
 
        // // assuming the listeners were bound
        // this.htmlCanvas.removeEventListener("pointermove", this.pointerMove);
        // this.htmlCanvas.removeEventListener("pointerup", this.pointerUp);
        // this.htmlCanvas.removeEventListener("pointerdown", this.pointerDown);
        // this.htmlCanvas.removeEventListener("pointercancel", this.pointerCancel);
        // this.htmlCanvas.removeEventListener("wheel", this.mouseWheel);
        // // Key listeners are added to the document because we don't want the
        // // canvas to have to be selected prior to listening for them
        // document.removeEventListener("keydown", this.keyDown);
        // document.removeEventListener("keyup", this.keyUp);
        this.boxSelector.dispose();
        this.sphereSelector.dispose();
    }

    setSelectedPoints(selection: PointsCollection) {
        console.debug("PointSelector.setSelectedPoints:", selection, this.objectId);
        this.selection = selection;
        console.debug("PointSelector.selectionChangedCallback: check", this.selectionChangedCallback);
        if (this.selectionChangedCallback !== null) {
            console.debug("PointSelector.selectionChangedCallback: exec");
            this.selectionChangedCallback(selection);
        }
    }

    setSelectionMode(mode: PointSelectionMode) {
        console.debug("PointSelector.setSelectionMode: ", mode);
        this.selectionMode = mode;
        switch (this.selectionMode) {
            case PointSelectionMode.BOX:
                this.sphereSelector.cursor.visible = false;
                this.sphereSelector.cursorControl.detach();
                this.sphereSelector.cursorLock = true;
                break;
            case PointSelectionMode.SPHERICAL_CURSOR:
                this.sphereSelector.cursor.visible = true;
                this.sphereSelector.cursorControl.detach();
                this.sphereSelector.cursorLock = true;
                break;
            case PointSelectionMode.SPHERE:
                this.sphereSelector.cursor.visible = true;
                this.sphereSelector.cursorControl.attach(this.sphereSelector.cursor);
                this.sphereSelector.cursorLock = true;
                break;
        }
    }
}