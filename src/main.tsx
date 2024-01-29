import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider as EmotionThemeProvider } from "@emotion/react";
import { StyledEngineProvider, ThemeProvider } from "@mui/material/styles";
import { defaultTheme } from "@czi-sds/components";

import App from "./app.tsx";
import "./index.css";

const domNode = document.getElementById("app")!;
const root = createRoot(domNode);
root.render(
    <React.StrictMode>
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={defaultTheme}>
                <EmotionThemeProvider theme={defaultTheme}>
                    <App />
                </EmotionThemeProvider>
            </ThemeProvider>
        </StyledEngineProvider>
    </React.StrictMode>,
);
