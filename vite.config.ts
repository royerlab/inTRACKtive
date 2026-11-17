/* eslint-disable spaced-comment */
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";

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
            provider: playwright(),
            instances: [{ browser: "chromium" }],
            headless: true,
        },
        coverage: {
            provider: "istanbul",
            include: ["src/**/*.{ts,tsx}"],
            exclude: ["**/.ipynb_checkpoints/**"],
        },
    },
});
