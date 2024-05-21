import { useEffect, useReducer, useRef, useState } from "react";

import { PointCanvas } from "@/lib/PointCanvas";
import { ViewerState } from "@/lib/ViewerState";

enum ActionType {
    AUTO_ROTATE = "AUTO_ROTATE",
    HIGHLIGHT_POINTS = "HIGHLIGHT_POINTS",
    POINT_BRIGHTNESS = "POINT_BRIGHTNESS",
    REFRESH = "REFRESH",
    REMOVE_ALL_TRACKS = "REMOVE_ALL_TRACKS",
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
    | ShowTracks
    | ShowTrackHighlights
    | SetMinMaxTime;

function reducer(canvas: PointCanvas, action: PointCanvasAction): PointCanvas {
    switch (action.type) {
        case ActionType.REFRESH:
            return canvas.shallowCopy();
        case ActionType.AUTO_ROTATE:
            canvas.controls.autoRotate = action.autoRotate;
            return canvas.shallowCopy();
        case ActionType.HIGHLIGHT_POINTS:
            canvas.highlightPoints(action.points);
            return canvas.shallowCopy();
        case ActionType.POINT_BRIGHTNESS:
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
    const [initialized, setInitialized] = useState(false);
    const divRef = useRef<HTMLDivElement>(null);
    const [canvas, dispatchCanvas] = useReducer(reducer, initialViewerState, createPointCanvas);

    // set up the canvas when the div is available
    // this is an effect because:
    //   * we only want to do this once, on mount
    //   * the div is empty when this is first called, until the Scene component is rendered
    useEffect(() => {
        if (!divRef.current || initialized) return;
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
        setInitialized(true);

        return () => {
            window.removeEventListener("resize", handleWindowResize);
            div.removeChild(canvas.renderer.domElement);
            canvas.dispose();
            setInitialized(false);
        };
    }, []);

    return [canvas, dispatchCanvas, divRef];
}

export { usePointCanvas, ActionType };
