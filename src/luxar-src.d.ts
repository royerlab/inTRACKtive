/**
 * TEMPORARY: @royerlab/luxar-viewer is not on npm yet, so it is resolved from a
 * sibling source checkout via the alias in vite.config.ts.
 *
 * Letting `tsc` follow that alias into Luxar's own source would typecheck ~145k
 * lines of another project under inTRACKtive's compiler options (~1200 errors
 * that say nothing about inTRACKtive), so the surface we use is restated here
 * instead. It is deliberately minimal — only what PointCanvas calls.
 *
 * Delete this file once the package is installed from npm: it ships its own
 * `.d.ts`, and this hand-written copy would then be a second source of truth.
 */
declare module "@royerlab/luxar-viewer" {
    import type * as THREE from "three";

    export interface ViewportSize {
        width: number;
        height: number;
    }

    export interface LuxarLayerOptions {
        renderer: THREE.WebGLRenderer;
        getCamera: () => THREE.Camera;
        getViewportSize: () => ViewportSize;
        scene: THREE.Scene;
        requestRender?: () => void;
        loaderConfig?: Record<string, unknown>;
        wasmPath?: string;
        workerPath?: string;
        lodFade?: boolean;
        lodEnergyComp?: boolean;
        lodFinest?: boolean;
        depthSort?: boolean;
        renderOrder?: number;
    }

    /** Only the fields inTRACKtive reads; the real type carries more. */
    export interface LayerDimensions {
        ndim: number;
        displayed: number[];
        currentStep: number[];
    }

    export class LuxarLayer {
        constructor(options: LuxarLayerOptions);
        readonly root: THREE.Group | null;
        load(src: string): Promise<THREE.Group>;
        update(): void;
        resize(): void;
        getDimensions(): LayerDimensions | null;
        getDimensionNames(): string[];
        findDimension(name: string): number | null;
        setDimensionValue(index: number, value: number): Promise<void>;
        prefetchDimensionValue(index: number, value: number, budgetMs?: number): void;
        awaitDimensionUpdate(): Promise<void>;
        setVisible(visible: boolean): void;
        isVisible(): boolean;
        setExposure(multiplier: number): void;
        getExposure(): number;
        getBounds(): THREE.Box3 | null;
        alignTo(matrix: THREE.Matrix4): void;
        dispose(): Promise<void>;
    }
}
