import { useCallback, useEffect, useReducer, useRef, Dispatch, RefObject } from "react";

import { Vector3 } from "three";

import { PointCanvas } from "@/lib/PointCanvas";
import { PointsCollection } from "@/lib/PointSelectionBox";
import { PointSelectionMode } from "@/lib/PointSelector";
import { ViewerState } from "@/lib/ViewerState";

enum ActionType {
    AUTO_ROTATE = "AUTO_ROTATE",
    CAMERA_PROPERTIES = "CAMERA_PROPERTIES",
    CUR_TIME = "CUR_TIME",
    HIGHLIGHT_POINTS = "HIGHLIGHT_POINTS",
    POINT_BRIGHTNESS = "POINT_BRIGHTNESS",
    REFRESH = "REFRESH",
    REMOVE_ALL_TRACKS = "REMOVE_ALL_TRACKS",
    SELECTION_MODE = "SELECTION_MODE",
    SHOW_TRACKS = "SHOW_TRACKS",
    SHOW_TRACK_HIGHLIGHTS = "SHOW_TRACK_HIGHLIGHTS",
    SIZE = "SIZE",
    MIN_MAX_TIME = "MIN_MAX_TIME",
}

interface AutoRotate {
    type: ActionType.AUTO_ROTATE;
    autoRotate: boolean;
}

interface CameraProperties {
    type: ActionType.CAMERA_PROPERTIES;
    cameraPosition: Vector3;
    cameraTarget: Vector3;
}

interface CurTime {
    type: ActionType.CUR_TIME;
    curTime: number | ((curTime: number) => number);
}

interface HighlightPoints {
    type: ActionType.HIGHLIGHT_POINTS;
    points: number[];
}

interface PointBrightness {
    type: ActionType.POINT_BRIGHTNESS;
    brightness: number;
}

interface Refresh {
    type: ActionType.REFRESH;
}

interface RemoveAllTracks {
    type: ActionType.REMOVE_ALL_TRACKS;
}

interface SelectionMode {
    type: ActionType.SELECTION_MODE;
    selectionMode: PointSelectionMode;
}

interface ShowTracks {
    type: ActionType.SHOW_TRACKS;
    showTracks: boolean;
}

interface ShowTrackHighlights {
    type: ActionType.SHOW_TRACK_HIGHLIGHTS;
    showTrackHighlights: boolean;
}

interface Size {
    type: ActionType.SIZE;
    width: number;
    height: number;
}

interface MinMaxTime {
    type: ActionType.MIN_MAX_TIME;
    minTime: number;
    maxTime: number;
}

// setting up a tagged union for the actions
type PointCanvasAction =
    | AutoRotate
    | CameraProperties
    | CurTime
    | HighlightPoints
    | PointBrightness
    | Refresh
    | RemoveAllTracks
    | SelectionMode
    | ShowTracks
    | ShowTrackHighlights
    | Size
    | MinMaxTime;

function reducer(canvas: PointCanvas, action: PointCanvasAction): PointCanvas {
    console.debug("usePointCanvas.reducer: ", action);
    const newCanvas = canvas.shallowCopy();
    switch (action.type) {
        case ActionType.REFRESH:
            break;
        case ActionType.CAMERA_PROPERTIES:
            newCanvas.setCameraProperties(action.cameraPosition, action.cameraTarget);
            break;
        case ActionType.CUR_TIME: {
            // if curTime is a function, call it with the current time
            if (typeof action.curTime === "function") {
                action.curTime = action.curTime(canvas.curTime);
            }
            newCanvas.curTime = action.curTime;
            newCanvas.minTime += action.curTime - canvas.curTime;
            newCanvas.maxTime += action.curTime - canvas.curTime;
            newCanvas.updateAllTrackHighlights();
            break;
        }
        case ActionType.AUTO_ROTATE:
            newCanvas.controls.autoRotate = action.autoRotate;
            break;
        case ActionType.HIGHLIGHT_POINTS:
            newCanvas.highlightPoints(action.points);
            break;
        case ActionType.POINT_BRIGHTNESS:
            newCanvas.pointBrightness = action.brightness;
            newCanvas.resetPointColors();
            break;
        case ActionType.REMOVE_ALL_TRACKS:
            newCanvas.removeAllTracks();
            newCanvas.pointBrightness = 1.0;
            newCanvas.resetPointColors();
            break;
        case ActionType.SELECTION_MODE:
            newCanvas.setSelectionMode(action.selectionMode);
            break;
        case ActionType.SHOW_TRACKS:
            newCanvas.showTracks = action.showTracks;
            newCanvas.updateAllTrackHighlights();
            break;
        case ActionType.SHOW_TRACK_HIGHLIGHTS:
            newCanvas.showTrackHighlights = action.showTrackHighlights;
            newCanvas.updateAllTrackHighlights();
            break;
        case ActionType.SIZE:
            newCanvas.setSize(action.width, action.height);
            break;
        case ActionType.MIN_MAX_TIME:
            newCanvas.minTime = action.minTime;
            newCanvas.maxTime = action.maxTime;
            newCanvas.updateAllTrackHighlights();
            break;
        default:
            console.warn("usePointCanvas reducer - unknown action type: %s", action);
            return canvas;
    }
    return newCanvas;
}

function createPointCanvas(initialViewerState: ViewerState): PointCanvas {
    // create the canvas with some default dimensions
    // these will be overridden when the canvas is inserted into a div
    const canvas = new PointCanvas(800, 600);

    // restore canvas from initial viewer state
    canvas.setCameraProperties(initialViewerState.cameraPosition, initialViewerState.cameraTarget);

    // start animating - this keeps the scene rendering when controls change, etc.
    canvas.animate();

    return canvas;
}

function usePointCanvas(
    initialViewerState: ViewerState,
): [PointCanvas, Dispatch<PointCanvasAction>, RefObject<HTMLDivElement>] {
    console.debug("usePointCanvas: ", initialViewerState);
    const divRef = useRef<HTMLDivElement>(null);
    const [canvas, dispatchCanvas] = useReducer(reducer, initialViewerState, createPointCanvas);

    // When the selection changes internally due to the user interacting with the canvas,
    // we need to trigger a react re-render.
    canvas.selector.selectionChanged = useCallback((_selection: PointsCollection) => {
        console.debug("selectionChanged: refresh");
        dispatchCanvas({ type: ActionType.REFRESH });
    }, []);

    // set up the canvas when the div is available
    // this is an effect because:
    //   * we only want to do this once, on mount
    //   * the div is empty when this is first called, until the Scene component is rendered
    useEffect(() => {
        console.debug("usePointCanvas: effect-mount");
        if (!divRef.current) return;
        const div = divRef.current;
        div.insertBefore(canvas.renderer.domElement, div.firstChild);
        const handleWindowResize = () => {
            if (!div) return;
            const renderWidth = div.clientWidth;
            const renderHeight = div.clientHeight;
            dispatchCanvas({ type: ActionType.SIZE, width: renderWidth, height: renderHeight });
        };
        window.addEventListener("resize", handleWindowResize);
        handleWindowResize();

        return () => {
            console.debug("usePointCanvas: effect-mount cleanup");
            window.removeEventListener("resize", handleWindowResize);
            div.removeChild(canvas.renderer.domElement);
        };
    }, [canvas.renderer.domElement]);

    return [canvas, dispatchCanvas, divRef];
}

export { usePointCanvas, ActionType };
