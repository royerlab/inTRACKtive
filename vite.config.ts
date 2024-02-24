/* eslint-disable spaced-comment */
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import jotaiDebugLabel from 'jotai/babel/plugin-debug-label'
import jotaiReactRefresh from 'jotai/babel/plugin-react-refresh'

export default defineConfig({
    plugins: [react({ babel: { plugins: [jotaiDebugLabel, jotaiReactRefresh] } })],
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
