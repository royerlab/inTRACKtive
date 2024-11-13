import { sentryVitePlugin } from "@sentry/vite-plugin";
/* eslint-disable spaced-comment */
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [
        react(),
        sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            telemetry: process.env.NODE_ENV === "production",
        }),
    ],

    resolve: {
        alias: {
            "@": "/src",
        },
    },

    test: {
        environment: "jsdom",
        browser: {
            enabled: true,
            provider: "playwright",
            name: "chromium", // browser name is required
            headless: true,
        },
        coverage: {
            provider: "istanbul",
            include: ["src/**"],
        },
    },

    build: {
        sourcemap: true,
    },
});
