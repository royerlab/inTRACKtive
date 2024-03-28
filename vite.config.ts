/* eslint-disable spaced-comment */
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
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
});
