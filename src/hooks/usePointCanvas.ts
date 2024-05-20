import { useEffect, useReducer } from "react";

import { PointCanvas } from "@/lib/PointCanvas";
import { ViewerState } from "@/lib/ViewerState";

enum ActionType {
    AUTO_ROTATE = "AUTO_ROTATE",
    HIGHLIGHT_POINTS = "HIGHLIGHT_POINTS",
    POINT_BRIGHTNESS = "POINT_BRIGHTNESS",
    REFRESH = "REFRESH",
    REMOVE_ALL_TRACKS = "REMOVE_ALL_TRACKS",
    SET_UP = "SET_UP",
    SHOW_TRACKS = "SHOW_TRACKS",
    SHOW_TRACK_HIGHLIGHTS = "SHOW_TRACK_HIGHLIGHTS",
    SET_MIN_MAX_TIME = "SET_MIN_MAX_TIME",
}

interface AutoRotate {
    type: ActionType.AUTO_ROTATE;
    autoRotate: boolean;
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

interface SetUp {
    type: ActionType.SET_UP;
    div: HTMLDivElement;
    cameraPosition: THREE.Vector3;
    cameraTarget: THREE.Vector3;
}

interface ShowTracks {
    type: ActionType.SHOW_TRACKS;
    showTracks: boolean;
}

interface ShowTrackHighlights {
    type: ActionType.SHOW_TRACK_HIGHLIGHTS;
    showTrackHighlights: boolean;
}

interface SetMinMaxTime {
    type: ActionType.SET_MIN_MAX_TIME;
    minTime: number;
    maxTime: number;
}

// setting up a tagged union for the actions
type PointCanvasAction =
    | AutoRotate
    | HighlightPoints
    | PointBrightness
    | Refresh
    | RemoveAllTracks
    | SetUp
    | ShowTracks
    | ShowTrackHighlights
    | SetMinMaxTime;

function reducer(canvas: PointCanvas, action: PointCanvasAction): PointCanvas {
    switch (action.type) {
        case ActionType.SET_UP:
            if (!action.div) return canvas;
            insertCanvasInDiv(canvas, action.div);
            canvas.setCameraProperties(action.cameraPosition, action.cameraTarget);
            return canvas.shallowCopy();
        case ActionType.REFRESH:
            return canvas.shallowCopy();
        case ActionType.AUTO_ROTATE:
            canvas.controls.autoRotate = action.autoRotate;
            return canvas.shallowCopy();
        case ActionType.HIGHLIGHT_POINTS:
            canvas.highlightPoints(action.points);
            return canvas.shallowCopy();
        case ActionType.POINT_BRIGHTNESS:
            console.log("fading points");
            canvas.pointBrightness = action.brightness;
            canvas.resetPointColors();
            return canvas.shallowCopy();
        case ActionType.REMOVE_ALL_TRACKS:
            canvas.removeAllTracks();
            return canvas.shallowCopy();
        case ActionType.SHOW_TRACKS:
            canvas.showTracks = action.showTracks;
            canvas.updateAllTrackHighlights();
            return canvas.shallowCopy();
        case ActionType.SHOW_TRACK_HIGHLIGHTS:
            canvas.showTrackHighlights = action.showTrackHighlights;
            canvas.updateAllTrackHighlights();
            return canvas.shallowCopy();
        case ActionType.SET_MIN_MAX_TIME:
            canvas.minTime = action.minTime;
            canvas.maxTime = action.maxTime;
            canvas.updateAllTrackHighlights();
            return canvas.shallowCopy();
        default:
            return canvas;
    }
}

function insertCanvasInDiv(canvas: PointCanvas, div: HTMLDivElement) {
    // if the canvas is already in the div, don't do anything
    if (canvas.renderer.domElement.parentElement === div) return;

    div.insertBefore(canvas.renderer.domElement, div.firstChild);
    const handleWindowResize = () => {
        if (!div) return;
        const renderWidth = div.clientWidth;
        const renderHeight = div.clientHeight;
        canvas.setSize(renderWidth, renderHeight);
    };
    window.addEventListener("resize", handleWindowResize);
    handleWindowResize();
}

function createPointCanvas(divRef: React.RefObject<HTMLDivElement>): PointCanvas {
    const renderWidth = divRef.current?.clientWidth || 800;
    const renderHeight = divRef.current?.clientHeight || 600;
    const canvas = new PointCanvas(renderWidth, renderHeight);

    // start animating - this keeps the scene rendering when controls change, etc.
    canvas.animate();

    return canvas;
}

let initialized = false;

function usePointCanvas(
    divRef: React.RefObject<HTMLDivElement>,
    initialViewerState: ViewerState,
): [PointCanvas, React.Dispatch<PointCanvasAction>] {
    const [state, dispatcher] = useReducer(reducer, divRef, createPointCanvas);

    // set up the canvas on mount
    // we need the effect here because the divRef may be null until after the component mounts
    useEffect(() => {
        if (!divRef.current || initialized) return;
        dispatcher({
            type: ActionType.SET_UP,
            div: divRef.current,
            cameraPosition: initialViewerState.cameraPosition,
            cameraTarget: initialViewerState.cameraTarget,
        });
        initialized = true;
    }, [divRef]);

    return [state, dispatcher];
}

export { usePointCanvas, ActionType };
