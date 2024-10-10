import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider as EmotionThemeProvider } from "@emotion/react";
import { StyledEngineProvider, ThemeProvider } from "@mui/material/styles";
import { defaultTheme } from "@czi-sds/components";
import * as Sentry from "@sentry/react";

import App from "@/components/App.tsx";
import "@/css/index.css";

Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
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

    // For traces, only log request URLs if its from our domain
    // (this is for when the user changes the zarr URL)
    beforeSend(event) {
        // If the event contains an HTTP request URL, inspect it
        if (event.request && event.request.url) {
            try {
                // Create a URL object to inspect the request URL
                const parsedUrl = new URL(event.request.url);
                // Only allow events for the specific domain
                if (parsedUrl.hostname !== "public.czbiohub.org") {
                    // Return null to drop the event if the hostname does not match
                    return null;
                }
            } catch (e) {
                // In case of invalid URL or parsing errors, drop the event
                return null;
            }
        }
        // Otherwise, allow the event to be sent to Sentry
        return event;
    },
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
