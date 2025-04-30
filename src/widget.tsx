import { createRender } from "@anywidget/react";
import App from "./components/App";

function Widget() {
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
