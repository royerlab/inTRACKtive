import { useEffect, useReducer, useRef } from "react";

import { PointCanvas } from "@/lib/PointCanvas";
import { ViewerState } from "@/lib/ViewerState";

enum ActionType {
    AUTO_ROTATE = "AUTO_ROTATE",
    CUR_TIME = "CUR_TIME",
    HIGHLIGHT_POINTS = "HIGHLIGHT_POINTS",
    POINT_BRIGHTNESS = "POINT_BRIGHTNESS",
    REFRESH = "REFRESH",
    REMOVE_ALL_TRACKS = "REMOVE_ALL_TRACKS",
    SHOW_TRACKS = "SHOW_TRACKS",
    SHOW_TRACK_HIGHLIGHTS = "SHOW_TRACK_HIGHLIGHTS",
    MIN_MAX_TIME = "MIN_MAX_TIME",
}

interface AutoRotate {
    type: ActionType.AUTO_ROTATE;
    autoRotate: boolean;
}

interface CurTime {
    type: ActionType.CUR_TIME;
    curTime: number;
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

interface ShowTracks {
    type: ActionType.SHOW_TRACKS;
    showTracks: boolean;
}

interface ShowTrackHighlights {
    type: ActionType.SHOW_TRACK_HIGHLIGHTS;
    showTrackHighlights: boolean;
}

interface MinMaxTime {
    type: ActionType.MIN_MAX_TIME;
    minTime: number;
    maxTime: number;
}

// setting up a tagged union for the actions
type PointCanvasAction =
    | AutoRotate
    | CurTime
    | HighlightPoints
    | PointBrightness
    | Refresh
    | RemoveAllTracks
    | ShowTracks
    | ShowTrackHighlights
    | MinMaxTime;

function reducer(canvas: PointCanvas, action: PointCanvasAction): PointCanvas {
    const newCanvas = canvas.shallowCopy();
    switch (action.type) {
        case ActionType.REFRESH:
            break;
        case ActionType.CUR_TIME: {
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
            break;
        case ActionType.SHOW_TRACKS:
            newCanvas.showTracks = action.showTracks;
            newCanvas.updateAllTrackHighlights();
            break;
        case ActionType.SHOW_TRACK_HIGHLIGHTS:
            newCanvas.showTrackHighlights = action.showTrackHighlights;
            newCanvas.updateAllTrackHighlights();
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
): [PointCanvas, React.Dispatch<PointCanvasAction>, React.RefObject<HTMLDivElement>] {
    const divRef = useRef<HTMLDivElement>(null);
    const [canvas, dispatchCanvas] = useReducer(reducer, initialViewerState, createPointCanvas);

    // set up the canvas when the div is available
    // this is an effect because:
    //   * we only want to do this once, on mount
    //   * the div is empty when this is first called, until the Scene component is rendered
    useEffect(() => {
        if (!divRef.current) return;
        const div = divRef.current;
        div.insertBefore(canvas.renderer.domElement, div.firstChild);
        const handleWindowResize = () => {
            if (!div) return;
            const renderWidth = div.clientWidth;
            const renderHeight = div.clientHeight;
            canvas.setSize(renderWidth, renderHeight);
        };
        window.addEventListener("resize", handleWindowResize);
        handleWindowResize();

        return () => {
            window.removeEventListener("resize", handleWindowResize);
            div.removeChild(canvas.renderer.domElement);
            canvas.dispose();
        };
    }, []);

    return [canvas, dispatchCanvas, divRef];
}

export { usePointCanvas, ActionType };