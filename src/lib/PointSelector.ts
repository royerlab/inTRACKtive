import {
    Matrix3,
    Mesh,
    MeshBasicMaterial,
    PerspectiveCamera,
    Points,
    Raycaster,
    Scene,
    SphereGeometry,
    Vector2,
    Vector3,
    WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/Addons.js";

import { PointSelectionBox, PointsCollection } from "@/lib/PointSelectionBox";

import { SelectionHelper } from "three/addons/interactive/SelectionHelper.js";

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

type SelectionChanged = (selection: PointsCollection) => void;

// Selecting with a sphere.
class SpherePointSelector {
    cursor = new Mesh(
        new SphereGeometry(25, 8, 8),
        new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.05 }),
    );
    cursorLock = true;
    cursorControl: TransformControls;
    pointer = new Vector2(0, 0);
    raycaster = new Raycaster();

    scene: Scene;
    renderer: WebGLRenderer;
    camera: PerspectiveCamera;
    controls: OrbitControls;
    points: Points;
    selectionChanged: SelectionChanged;

    constructor(
        scene: Scene,
        renderer: WebGLRenderer,
        camera: PerspectiveCamera,
        controls: OrbitControls,
        points: Points,
        selectionChanged: SelectionChanged,
    ) {
        this.scene = scene;
        this.renderer = renderer;
        this.camera = camera;
        this.controls = controls;
        this.points = points; 
        this.selectionChanged = selectionChanged;

        this.cursorControl = new TransformControls(camera, renderer.domElement);
        this.cursorControl.size = 0.5;
        this.cursorControl.attach(this.cursor);

        this.scene.add(this.cursor);

        const draggingChanged = (event: { value: unknown }) => {
            this.controls.enabled = !event.value;
        };
        this.cursorControl.addEventListener("dragging-changed", draggingChanged);
    }

    keyDown(event: KeyboardEvent) {
        switch (event.key) {
            case "Control":
                this.controls.enabled = false;
                break;
            case "Shift":
                this.cursorLock = false;
                break;
        }
    };

    keyUp(event: KeyboardEvent) {
        switch (event.key) {
            case "Control":
                this.controls.enabled = true;
                break;
            case "Shift":
                this.cursorLock = true;
                break;
            case "s":
                this.cursor.visible = !this.cursor.visible;
                this.cursorControl.visible = this.cursorControl.enabled && this.cursor.visible;
                break;
            case "w":
                this.cursorControl.setMode("translate");
                break;
            case "e":
                this.cursorControl.setMode("rotate");
                break;
            case "r":
                this.cursorControl.setMode("scale");
                break;
        }
    };

    mouseWheel(event: WheelEvent) {
        if (event.ctrlKey) {
            event.preventDefault();
            this.cursor.scale.multiplyScalar(1 + event.deltaY * 0.001);
        }
    };

    pointerMove(event: MouseEvent) {
        if (this.cursorLock) {
            return;
        }
        const canvasElement = this.renderer.domElement.getBoundingClientRect();
        this.pointer.x = ((event.clientX - canvasElement.left) / canvasElement.width) * 2 - 1;
        this.pointer.y = (-(event.clientY - canvasElement.top) / canvasElement.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const intersects = this.raycaster.intersectObject(this.points);
        if (intersects.length > 0) {
            this.cursor.position.set(intersects[0].point.x, intersects[0].point.y, intersects[0].point.z);
        }
    };

    pointerUp(event: MouseEvent) {
        if (!event.shiftKey || !this.cursor.visible) {
            return;
        }
        // return list of points inside cursor sphere
        const radius = this.cursor.geometry.parameters.radius;
        const normalMatrix = new Matrix3();
        normalMatrix.setFromMatrix4(this.cursor.matrixWorld);
        normalMatrix.invert();
        const center = this.cursor.position;
        const geometry = this.points.geometry;
        const positions = geometry.getAttribute("position");
        const numPoints = positions.count;
        const selected = [];
        for (let i = 0; i < numPoints; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);
            const vecToCenter = new Vector3(x, y, z).sub(center);
            const scaledVecToCenter = vecToCenter.applyMatrix3(normalMatrix);
            if (scaledVecToCenter.length() < radius) {
                selected.push(i);
            }
        }
        const points: PointsCollection = new Map();
        points.set(this.points.id, selected);
        console.log("selected points:", selected);
        this.selectionChanged(points);
    };

    pointerDown(event: MouseEvent) {}

    pointerCancel(event: MouseEvent) {}

    dispose() {
        // TODO: remove dragging callback
    }
};

// Selection with a rectangle.
class BoxPointSelector {
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

    mouseWheel(event: WheelEvent) {}

    pointerMove(event: MouseEvent) {}

    pointerUp(event: MouseEvent) {
        console.debug("pointerUp");
        this.blocked = false;
        if (!this.selecting()) return;
        this.updateSelectedPoints();
    };

    pointerCancel(event: MouseEvent) {
        this.blocked = false;
    };

    pointerDown(event: MouseEvent) {
        this.blocked = true;
    };

    keyDown(event: KeyboardEvent) {
        console.debug("keyDown: %s", event.key);
        // ignore repeats (key held down)
        if (event.repeat) {
            return;
        }
        if (event.key === "Shift") {
            this.setSelecting(true);
        }
    };

    keyUp(event: KeyboardEvent) {
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

// this is a separate class to keep the point selection logic separate from the rendering logic in
// the PointCanvas class this fixes some issues with callbacks and event listeners binding to
// the original instance of the class, though we make many (shallow) copies of the PointCanvas
// to update state in the app
export class PointSelector {
    boxSelector: BoxPointSelector;
    sphereSelector: SpherePointSelector;
    htmlCanvas: HTMLCanvasElement;

    // Current selection mode.
    selectionMode: PointSelectionMode = PointSelectionMode.BOX;

    // Current selection.
    selection: PointsCollection = new Map();

    // Selection change callback.
    selectionChanged: SelectionChanged | null = null;

    constructor(
        scene: Scene,
        renderer: WebGLRenderer,
        camera: PerspectiveCamera,
        controls: OrbitControls,
        points: Points,
    ) {
        this.boxSelector = new BoxPointSelector(scene, renderer, camera, controls, this.setSelectedPoints);
        this.sphereSelector = new SpherePointSelector(scene, renderer, camera, controls, points, this.setSelectedPoints);
        
        this.htmlCanvas = renderer.domElement;
        this.htmlCanvas.addEventListener("pointermove", this.pointerMove);
        this.htmlCanvas.addEventListener("pointerup", this.pointerUp);
        this.htmlCanvas.addEventListener("pointerdown", this.pointerDown);
        this.htmlCanvas.addEventListener("pointercancel", this.pointerCancel);
        this.htmlCanvas.addEventListener("wheel", this.mouseWheel);
        // Key listeners are added to the document because we don't want the
        // canvas to have to be selected prior to listening for them
        document.addEventListener("keydown", this.keyDown);
        document.addEventListener("keyup", this.keyUp);
    }

    keyDown = (event: KeyboardEvent) => {console.debug("keyDown", event); this.selector().keyDown(event);};
    keyUp = (event: KeyboardEvent) => {this.selector().keyUp(event);};
    mouseWheel = (event: WheelEvent) => {this.selector().mouseWheel(event);};
    pointerMove = (event: MouseEvent) => {this.selector().pointerMove(event);};
    pointerUp = (event: MouseEvent) => {this.selector().pointerUp(event);};
    pointerDown = (event: MouseEvent) => {this.selector().pointerDown(event);};
    pointerCancel = (event: MouseEvent) => {this.selector().pointerCancel(event);};

    selector() : PointSelectorInterface {
        console.debug("selectionMode: ", this.selectionMode);
        return this.selectionMode === PointSelectionMode.BOX ? this.boxSelector : this.sphereSelector;
    }

    dispose() {
        this.htmlCanvas.removeEventListener("pointermove", this.pointerMove);
        this.htmlCanvas.removeEventListener("pointerup", this.pointerUp);
        this.htmlCanvas.removeEventListener("wheel", this.mouseWheel);
        // Key listeners are added to the document because we don't want the
        // canvas to have to be selected prior to listening for them
        document.removeEventListener("keydown", this.keyDown);
        document.removeEventListener("keyup", this.keyUp);
        this.boxSelector.dispose();
        this.sphereSelector.dispose();
    }

    setSelectedPoints(selection: PointsCollection) {
        console.log("setSelectedPoints:", selection);
        this.selection = selection;
        if (this.selectionChanged) this.selectionChanged(selection);
    }

    setSelectionMode(mode: PointSelectionMode) {
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