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

    // If the user puts a custom zarr url outside of "public.czbiohub.org", we will drop the transaction
    beforeSendTransaction(event) {
        // Check if the event contains spans (which represent individual requests/operations)
        if (event.spans && event.spans.length > 0) {
            for (const span of event.spans) {
                // Check if the span is an HTTP request (fetch or XHR)
                if (span.op === "http.client" || span.op === "fetch") {
                    try {
                        // Parse the URL from the span
                        const parsedUrl = new URL(span.data?.url);
                        // If the domain is not 'public.czbiohub.org', drop the transaction
                        if (parsedUrl.hostname !== "public.czbiohub.org") {
                            return null; // Drop the transaction
                        }
                    } catch (e) {
                        // In case of an invalid URL or parsing error, drop the transaction
                        return null;
                    }
                }
            }
        }
        // Allow the transaction if all requests are to the allowed domain
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
