/* eslint-disable spaced-comment */
/// <reference types="vitest" />
import path from "node:path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// TEMPORARY: @royerlab/luxar-viewer is not on npm yet, so resolve it from the
// sibling checkout's source entry point. The import specifier in application
// code is already the real package name, so publishing means deleting this
// alias and running `npm install @royerlab/luxar-viewer` — nothing else.
const luxarViewerSrc = path.resolve(__dirname, "../luxar/packages/luxar-viewer/src");

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": "/src",
            "@royerlab/luxar-viewer": luxarViewerSrc,
        },
        // Luxar has no `three` of its own installed (it is a peer dep), and two
        // copies would silently break every instanceof across the boundary.
        dedupe: ["three"],
    },
    server: {
        fs: {
            // Vite refuses to serve files outside the project root by default.
            allow: [path.resolve(__dirname), luxarViewerSrc],
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
});
