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

import { PointsCollection } from "@/lib/PointSelectionBox";

import { SelectionChanged } from "@/lib/PointSelector";

// Selecting with a sphere, with optional transform controls.
export class SpherePointSelector {
    readonly cursor = new Mesh(
        new SphereGeometry(25, 8, 8),
        new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.05 }),
    );
    readonly raycaster = new Raycaster();
    readonly scene: Scene;
    readonly renderer: WebGLRenderer;
    readonly camera: PerspectiveCamera;
    readonly controls: OrbitControls;
    readonly points: Points;
    readonly selectionChanged: SelectionChanged;

    // True if this should not respond to pointer movements, false otherwise.
    cursorLock = true;
    cursorControl: TransformControls;
    pointer = new Vector2(0, 0);

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

        // Value of 10 arbitrarily chosen for a decent experience,
        // compared to 1 which can be sluggish.
        this.raycaster.params.Points.threshold = 10;

        this.cursorControl = new TransformControls(camera, renderer.domElement);
        this.cursorControl.size = 0.5;
        this.setVisible(false, false);

        this.scene.add(this.cursor);
        this.scene.add(this.cursorControl);

        this.draggingChanged = this.draggingChanged.bind(this);
        this.cursorControl.addEventListener("dragging-changed", this.draggingChanged);
    }

    dispose() {
        this.cursorControl.removeEventListener("dragging-changed", this.draggingChanged);
        this.cursorControl.dispose();
        this.scene.remove(this.cursor);
        this.scene.remove(this.cursorControl);
    }

    setVisible(visible: boolean, controlsVisible: boolean) {
        this.cursorLock = true;
        this.cursor.visible = visible;
        this.cursorControl.visible = visible;
        if (controlsVisible) {
            this.cursorControl.attach(this.cursor);
        } else {
            this.cursorControl.detach();
        }
    }

    draggingChanged(event: { value: unknown }) {
        this.controls.enabled = !event.value;
    }

    keyDown(event: KeyboardEvent) {
        console.debug("SpherePointSelector.keyDown: ", event);
        switch (event.key) {
            case "Control":
                this.controls.enabled = false;
                break;
            case "Shift":
                if (this.cursor.visible && !this.cursorControl.object) {
                    this.cursorLock = false;
                }
                break;
        }
    }

    keyUp(event: KeyboardEvent) {
        console.debug("SpherePointSelector.keyUp: ", event);
        switch (event.key) {
            case "Control":
                this.controls.enabled = true;
                break;
            case "Shift":
                this.cursorLock = true;
                break;
            case "s":
                this.cursor.visible = !this.cursor.visible;
                this.cursorControl.visible = !!this.cursorControl.object && this.cursor.visible;
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
    }

    mouseWheel(event: WheelEvent) {
        console.debug("SpherePointSelector.mouseWheel: ", event);
        if (event.ctrlKey) {
            event.preventDefault();
            this.cursor.scale.multiplyScalar(1 + event.deltaY * 0.001);
        }
    }

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
    }

    pointerUp(event: MouseEvent) {
        console.debug("SpherePointSelector.pointerUp: ", event);
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
    }

    pointerDown(_event: MouseEvent) {}

    pointerCancel(_event: MouseEvent) {}
}
