/* eslint-disable spaced-comment */
/// <reference types="vitest/config" />
import fs from "node:fs";
import path from "node:path";

import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";

// @luxar/viewer looks for its WASM module at `<origin>/wasm/luxar_wasm.js` and
// falls back to a slower TypeScript path when it is missing. The package ships
// the files but does not export them, so serve them in dev and copy them into
// the build at that path.
const luxarWasmDir = path.resolve(__dirname, "node_modules/@luxar/viewer/dist/lib/wasm");
function luxarWasm(): Plugin {
    const files = () => fs.readdirSync(luxarWasmDir).filter((f) => /\.(js|wasm)$/.test(f));
    return {
        name: "luxar-wasm",
        configureServer(server) {
            server.middlewares.use("/wasm", (req, res, next) => {
                const name = path.basename(req.url ?? "");
                if (!files().includes(name)) return next();
                res.setHeader("Content-Type", name.endsWith(".wasm") ? "application/wasm" : "text/javascript");
                fs.createReadStream(path.join(luxarWasmDir, name)).pipe(res);
            });
        },
        generateBundle() {
            for (const name of files()) {
                this.emitFile({
                    type: "asset",
                    fileName: `wasm/${name}`,
                    source: fs.readFileSync(path.join(luxarWasmDir, name)),
                });
            }
        },
    };
}

export default defineConfig({
    plugins: [react(), luxarWasm()],
    resolve: {
        alias: {
            "@": "/src",
        },
        // `three` is a peer dependency of @luxar/viewer; two copies would
        // silently break every instanceof across the boundary.
        dedupe: ["three"],
    },

    // Pre-bundling @luxar/viewer moves it into node_modules/.vite/deps, which
    // breaks the `new URL(..., import.meta.url)` paths to its workers.
    optimizeDeps: {
        exclude: ["@luxar/viewer"],
    },

    // @luxar/viewer spawns module workers that themselves code-split; Vite's
    // default IIFE worker format cannot.
    worker: {
        format: "es",
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
