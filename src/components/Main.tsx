import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider as EmotionThemeProvider } from "@emotion/react";
import { StyledEngineProvider, ThemeProvider } from "@mui/material/styles";
import { defaultTheme } from "@czi-sds/components";
import * as Sentry from "@sentry/react";

import App from "@/components/App.tsx";
import "@/css/index.css";

Sentry.init({
    dsn: import.meta.env.SENTRY_DSN,
    integrations: [
        Sentry.browserTracingIntegration(),
        // Disable breadcrumbs
        Sentry.breadcrumbsIntegration({
            console: false,
            dom: false,
            fetch: false,
            history: false,
            xhr: false,
        }),
    ],
    // Tracing
    tracesSampleRate: 1.0, //  Capture 100% of the transactions
    // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
    tracePropagationTargets: [
        /^https:\/\/intracktive\.sf\.czbiohub\.org/, // Match all URLs from this domain including base URL and paths
    ],
});

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
