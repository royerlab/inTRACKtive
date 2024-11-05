import { useCallback, useEffect, useReducer, useRef, Dispatch, RefObject } from "react";

import { PointCanvas } from "@/lib/PointCanvas";
import { PointSelectionMode } from "@/lib/PointSelector";
import { ViewerState } from "@/lib/ViewerState";

enum ActionType {
    AUTO_ROTATE = "AUTO_ROTATE",
    CUR_TIME = "CUR_TIME",
    INIT_POINTS_GEOMETRY = "INIT_POINTS_GEOMETRY",
    TRACK_WIDTH = "TRACK_WIDTH",
    POINT_BRIGHTNESS = "POINT_BRIGHTNESS",
    POINTS_POSITIONS = "POINTS_POSITIONS",
    RESET_POINTS_COLORS = "POINT_COLORS",
    REMOVE_LAST_SELECTION = "REMOVE_LAST_SELECTION",
    POINT_SIZES = "POINT_SIZES",
    REFRESH = "REFRESH",
    REMOVE_ALL_TRACKS = "REMOVE_ALL_TRACKS",
    SELECTION_MODE = "SELECTION_MODE",
    SHOW_TRACKS = "SHOW_TRACKS",
    SHOW_TRACK_HIGHLIGHTS = "SHOW_TRACK_HIGHLIGHTS",
    SIZE = "SIZE",
    MIN_MAX_TIME = "MIN_MAX_TIME",
    ADD_SELECTED_POINT_IDS = "ADD_SELECTED_POINT_IDS",
    SHOW_PREVIEW_POINTS = "SHOW_PREVIEW_POINTS",
    UPDATE_WITH_STATE = "UPDATE_WITH_STATE",
    MOBILE_SELECT_CELLS = "MOBILE_SELECT_CELLS",
    SELECTOR_SCALE = "SELECTOR_SCALE",
    TOGGLE_AXES = "TOGGLE_AXES",
}

interface AutoRotate {
    type: ActionType.AUTO_ROTATE;
    autoRotate: boolean;
}

interface CurTime {
    type: ActionType.CUR_TIME;
    curTime: number | ((curTime: number) => number);
}

interface InitPointsGeometry {
    type: ActionType.INIT_POINTS_GEOMETRY;
    maxPointsPerTimepoint: number;
}

interface TrackWidth {
    type: ActionType.TRACK_WIDTH;
    ratio: number;
}

interface PointBrightness {
    type: ActionType.POINT_BRIGHTNESS;
    brightness: number;
}

interface PointSizes {
    type: ActionType.POINT_SIZES;
    pointSize: number;
}

interface PointsPositions {
    type: ActionType.POINTS_POSITIONS;
    positions: Float32Array;
}

interface PointColors {
    type: ActionType.RESET_POINTS_COLORS;
}

interface RemoveLastSelection {
    type: ActionType.REMOVE_LAST_SELECTION;
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

interface AddSelectedPointIds {
    type: ActionType.ADD_SELECTED_POINT_IDS;
    selectedPointIndices: number[];
    selectedPointIds: Set<number>;
}

interface ShowPreviewPoints {
    type: ActionType.SHOW_PREVIEW_POINTS;
    selectedPointIndices: number[];
}

interface UpdateWithState {
    type: ActionType.UPDATE_WITH_STATE;
    state: ViewerState;
}

interface MobileSelectCells {
    type: ActionType.MOBILE_SELECT_CELLS;
}

interface SelectorScale {
    type: ActionType.SELECTOR_SCALE;
    scale: number;
}

interface ToggleAxes {
    type: ActionType.TOGGLE_AXES;
}

// setting up a tagged union for the actions
type PointCanvasAction =
    | AutoRotate
    | CurTime
    | InitPointsGeometry
    | TrackWidth
    | PointBrightness
    | PointSizes
    | PointsPositions
    | PointColors
    | RemoveLastSelection
    | Refresh
    | RemoveAllTracks
    | SelectionMode
    | ShowTracks
    | ShowTrackHighlights
    | Size
    | MinMaxTime
    | AddSelectedPointIds
    | ShowPreviewPoints
    | UpdateWithState
    | MobileSelectCells
    | SelectorScale
    | ToggleAxes;

function reducer(canvas: PointCanvas, action: PointCanvasAction): PointCanvas {
    console.debug("usePointCanvas.reducer: ", action);
    const newCanvas = canvas.shallowCopy();
    switch (action.type) {
        case ActionType.REFRESH:
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
        case ActionType.INIT_POINTS_GEOMETRY:
            newCanvas.initPointsGeometry(action.maxPointsPerTimepoint);
            break;
        case ActionType.TRACK_WIDTH:
            newCanvas.trackWidthRatio = action.ratio;
            newCanvas.updateAllTrackHighlights();
            break;
        case ActionType.POINT_BRIGHTNESS:
            newCanvas.pointBrightness = action.brightness;
            newCanvas.resetPointColors();
            newCanvas.updateSelectedPointIndices();
            newCanvas.updatePreviewPoints();
            break;
        case ActionType.POINT_SIZES:
            newCanvas.pointSize = action.pointSize;
            newCanvas.setPointsSizes();
            break;
        case ActionType.POINTS_POSITIONS:
            newCanvas.setPointsPositions(action.positions);
            newCanvas.resetPointColors();
            newCanvas.updateSelectedPointIndices();
            newCanvas.updatePreviewPoints();
            break;
        case ActionType.RESET_POINTS_COLORS:
            newCanvas.resetPointColors();
            break;
        case ActionType.REMOVE_LAST_SELECTION:
            newCanvas.removeLastSelection();
            break;
        case ActionType.REMOVE_ALL_TRACKS:
            newCanvas.removeAllTracks();
            newCanvas.clearPointIndicesCache();
            newCanvas.pointBrightness = 1.0;
            newCanvas.resetPointColors();
            newCanvas.updatePreviewPoints();
            break;
        case ActionType.SELECTION_MODE: {
            const modeOld: PointSelectionMode | null = canvas.selector.selectionMode;
            const modeNew: PointSelectionMode = action.selectionMode;
            newCanvas.setSelectionMode(action.selectionMode);

            // reset the preview highlights when switching between box and spherical cursors (not when switching between spheres)
            if (modeOld == PointSelectionMode.BOX && modeNew !== PointSelectionMode.BOX) {
                newCanvas.resetPointColors();
                newCanvas.highlightPoints(newCanvas.selectedPointIndices);
            }
            if (modeOld !== PointSelectionMode.BOX && (modeNew == PointSelectionMode.BOX || modeNew == null)) {
                newCanvas.resetPointColors();
                newCanvas.highlightPoints(newCanvas.selectedPointIndices);
            }
            break;
        }
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
        case ActionType.ADD_SELECTED_POINT_IDS: {
            const newSelectedPointIds = new Set(canvas.selectedPointIds);
            for (const trackId of action.selectedPointIds) {
                newSelectedPointIds.add(trackId);
            }
            if (action.selectedPointIds.size !== 0) {
                // only reduce pointBrightness if there are selected points
                newCanvas.pointBrightness = 0.8;
            }
            newCanvas.resetPointColors();
            newCanvas.selectedPointIds = newSelectedPointIds;
            newCanvas.updateSelectedPointIndices();
            newCanvas.highlightPoints(action.selectedPointIndices);
            break;
        }
        case ActionType.SHOW_PREVIEW_POINTS: {
            newCanvas.resetPointColors();
            if (canvas.selector.selectionMode !== PointSelectionMode.BOX) {
                newCanvas.highlightPreviewPoints(action.selectedPointIndices);
            }
            newCanvas.highlightPoints(newCanvas.selectedPointIndices);
            break;
        }
        case ActionType.UPDATE_WITH_STATE:
            newCanvas.updateWithState(action.state);
            break;
        case ActionType.MOBILE_SELECT_CELLS:
            newCanvas.MobileSelectCells();
            break;
        case ActionType.SELECTOR_SCALE:
            newCanvas.setSelectorScale(action.scale);
            newCanvas.updatePreviewPoints();
            break;
        case ActionType.TOGGLE_AXES:
            newCanvas.toggleAxesHelper();
            break;
        default:
            console.warn("usePointCanvas reducer - unknown action type: %s", action);
            return canvas;
    }
    return newCanvas;
}

function createPointCanvas(initialViewerState: ViewerState): PointCanvas {
    console.debug("createPointCanvas: ", initialViewerState);
    // create the canvas with some default dimensions
    // these will be overridden when the canvas is inserted into a div
    const canvas = new PointCanvas(800, 600);

    // Update the state from any initial values.
    canvas.updateWithState(initialViewerState);

    // start animating - this keeps the scene rendering when controls change, etc.
    canvas.animate();

    return canvas;
}

function usePointCanvas(
    initialViewerState: ViewerState,
): [PointCanvas, Dispatch<PointCanvasAction>, RefObject<HTMLDivElement>] {
    const divRef = useRef<HTMLDivElement>(null);
    const [canvas, dispatchCanvas] = useReducer(reducer, initialViewerState, createPointCanvas);

    // When the selection changes internally due to the user interacting with the canvas,
    // we need to dispatch an addition to the canvas' state.
    canvas.selector.selectionChanged = useCallback(
        (pointIndices: number[]) => {
            console.debug("selectionChanged:", pointIndices);
            const pointIds = new Set(pointIndices.map((p) => canvas.curTime * canvas.maxPointsPerTimepoint + p));
            dispatchCanvas({
                type: ActionType.ADD_SELECTED_POINT_IDS,
                selectedPointIndices: pointIndices,
                selectedPointIds: pointIds,
            });
        },
        [canvas.curTime, canvas.maxPointsPerTimepoint],
    );

    canvas.selector.selectionPreviewChanged = useCallback((pointIndices: number[]) => {
        console.debug("selectionPreviewChanged:", pointIndices);
        dispatchCanvas({
            type: ActionType.SHOW_PREVIEW_POINTS,
            selectedPointIndices: pointIndices,
        });
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
