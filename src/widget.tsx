declare global {
    interface Window {
        INITIAL_DATASET_URL?: string;
        SELECTION_CHANGED_CALLBACK?: (pointIndices: number[]) => void;
        select_cells?: (pointIds: number[]) => void;
        model?: {
            model: unknown;
            setSelectedCells: (cells: number[]) => void;
        };
    }
}

if (typeof document !== "undefined") {
    const style = document.createElement("style");
    style.textContent = `
      /* Switch overrides */
      .MuiSwitch-root .MuiSwitch-track {
        background-color: #E0E0E0 !important;
      }
      .MuiSwitch-root .MuiSwitch-thumb {
        background-color: #FFFFFF !important;
        border: 1px solid #C4C4C4 !important;
      }
      .MuiSwitch-root .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track {
        background-color: #FFFFFF !important;
      }
      .MuiSwitch-root .MuiSwitch-switchBase.Mui-checked .MuiSwitch-thumb {
        background-color: #1976d2 !important;
      }
  
      /* Slider overrides */
      /* Gray "rail" (unfilled track) */
      .MuiSlider-root .MuiSlider-rail {
        background-color: #E0E0E0 !important;
      }
      /* Blue "track" (filled portion) */
      .MuiSlider-root .MuiSlider-track {
        background-color: #1976d2 !important;
      }
      /* White thumb with blue border */
      .MuiSlider-root .MuiSlider-thumb {
        background-color: #FFFFFF !important;
        border: 2px solid #1976d2 !important;
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(style);
}

import { createRender, useModelState } from "@anywidget/react";
import App from "./components/App";
import { useEffect } from "react";

function Widget() {
    const [model] = useModelState("model");
    const [datasetUrl] = useModelState<string>("dataset_url");
    const [, setSelectedTracks] = useModelState("get_selected_tracks");
    const [selectedCells, setSelectedCells] = useModelState("selected_cells");

    if (typeof window !== "undefined") {
        window.SELECTION_CHANGED_CALLBACK = (trackIDs) => {
            setSelectedTracks(trackIDs);
        };
        window.model = { model, setSelectedCells };
    }

    if (typeof window !== "undefined" && datasetUrl) {
        window.INITIAL_DATASET_URL = datasetUrl;
    }

    useEffect(() => {
        if (typeof window !== "undefined" && Array.isArray(selectedCells)) {
            if (window.select_cells) {
                window.select_cells(selectedCells);
            }
        }
    }, [selectedCells]);

    return (
        <div
            style={{
                width: "100%",
                height: "800px",
                position: "relative",
                overflow: "hidden",
            }}
        >
            <App />
        </div>
    );
}

export default {
    render: createRender(Widget),
};
