import { Matrix4, PerspectiveCamera, Scene, Vector2, Vector3, WebGLRenderer } from "three";
// Type-only: erased at build time, so it costs nothing for sessions without imaging.
import type { LuxarLayer } from "@luxar/viewer";

export type ImagingScaleSettings = { meanX?: number; meanY?: number; meanZ?: number; extentXYZ?: number };

interface ImagingLayerOptions {
    renderer: WebGLRenderer;
    getCamera: () => PerspectiveCamera;
    scene: Scene;
    /**
     * How to place the splats in world space:
     * - `tracks`: apply the tracks' normalization (the default).
     * - `none`: leave them as they are, for scenes already in viewer space.
     * - `fit`: center the scene's own bounds and scale them to the cells' unit
     *   box. For looking at imaging that has no matching tracks.
     */
    align: "tracks" | "none" | "fit";
}

/**
 * A Luxar imaging scene rendered into inTRACKtive's own THREE scene, sharing
 * its renderer and camera.
 *
 * `@luxar/viewer` is several MB, so it is imported dynamically: sessions that
 * do not load imaging never download it. Because the layer therefore arrives
 * asynchronously, this wrapper records the requested state (visibility,
 * exposure, time, alignment) and applies whatever was last requested once the
 * layer is ready. Callers never need to wait on the load.
 *
 * The source can change at any time (`setSource`): it may come from the URL,
 * from a shared link, or from the tracks zarr once that has loaded.
 *
 * `PointCanvas.shallowCopy` copies this object by reference, so every copy
 * React holds talks to the same layer.
 */
export class ImagingLayer {
    private layer: LuxarLayer | null = null;
    /**
     * The camera the imaging is rendered with: the host camera, scaled up by
     * `1 / worldScale` about the origin.
     *
     * The splats are NOT shrunk into inTRACKtive's unit box. Luxar's splat
     * brightness depends on world-space size (volumetric optical depth most of
     * all), so scaling the layer root down by `extent_xyz` (~1e-3..1e-5) left
     * the imaging nearly black. Scaling the camera up instead gives the same
     * image, and the same depth buffer, because near and far scale with it.
     */
    readonly camera = new PerspectiveCamera();
    /** inTRACKtive world units per splat unit (the tracks' 1 / extent_xyz). */
    private worldScale = 1;
    /** `fit` mode: placement computed once from the scene's own bounds. */
    private fitPlacement: { matrix: Matrix4; scale: number } | null = null;
    private src: string | null = null;
    /** Bumped on every source change, so a slow load for an old source is discarded. */
    private generation = 0;

    private visible = true;
    private exposure = 1.0;
    private time: number | null = null;
    private scaleSettings: ImagingScaleSettings | null = null;

    constructor(private readonly options: ImagingLayerOptions) {}

    /** The scene URL currently shown (or loading), or null for none. */
    get source(): string | null {
        return this.src;
    }

    /** Load a scene, replacing any current one. `null` removes the imaging. */
    setSource(src: string | null) {
        if (src === this.src) return;
        this.src = src;
        this.generation++;
        this.fitPlacement = null;
        void this.layer?.dispose();
        this.layer = null;
        if (src !== null) void this.load(src, this.generation);
    }

    private async load(src: string, generation: number) {
        const stale = () => generation !== this.generation;
        let layer: LuxarLayer | null = null;
        try {
            const { LuxarLayer } = await import("@luxar/viewer");
            if (stale()) return;
            const { renderer, scene } = this.options;
            layer = new LuxarLayer({
                renderer,
                getCamera: () => this.camera,
                getViewportSize: () => {
                    const s = renderer.getSize(new Vector2());
                    return { width: s.x, height: s.y };
                },
                scene,
            });
            await layer.load(src);
            if (stale()) {
                await layer.dispose();
                return;
            }
            this.layer = layer;
            // Apply everything requested while loading. Time matters most: a
            // shared link restoring t=150 would otherwise show the scene's own
            // first slice until the slider is touched.
            layer.setVisible(this.visible);
            layer.setExposure(this.exposure);
            this.applyAlignment();
            this.applyTime();
        } catch (e: unknown) {
            console.error("[ImagingLayer] failed to load %s", src, e);
            void layer?.dispose();
        }
    }

    /** Show/hide. Keeps the scene loaded, so it toggles instantly. */
    setVisible(visible: boolean) {
        this.visible = visible;
        this.layer?.setVisible(visible);
    }

    /**
     * Exposure relative to the scene's authored value.
     *
     * A scene bakes an exposure tuned against whichever post chain it was
     * authored in; inTRACKtive adds bloom and an OutputPass on top, so the same
     * scene can arrive dim or blown out here through no fault of the data.
     */
    setExposure(value: number) {
        this.exposure = value;
        this.layer?.setExposure(value);
    }

    /**
     * Drive the layer's time dimension from inTRACKtive's timepoint.
     *
     * Deliberately not awaited: splat slices stream, and blocking playback on
     * them would make the tracks stutter. The splats lag and catch up instead.
     */
    setTime(t: number) {
        this.time = t;
        this.applyTime();
    }

    /**
     * Place the imaging in the same world space as the cells.
     *
     * inTRACKtive stores RAW coordinates in its zarr and normalizes them in the
     * browser (`TrackManager.applyScale`), using attributes written at convert
     * time:
     *
     *     world = (data_zyx - [mean_z, mean_y, mean_x]) / extent_xyz
     *
     * where `extent_xyz` is a single isotropic divisor, so aspect ratio is
     * preserved and the result lands in [-1, 1]. Points are stored `[z, y, x]`,
     * which is why world X is the data's z.
     *
     * The same affine is applied to the splats. Scaling the layer root is enough
     * for BOTH centers and covariances: Luxar's gsplat shader rotates the
     * Cholesky by `mat3(modelViewMatrix)`, which carries the scale.
     *
     * This assumes the fit's centers are in the same units as the tracks (voxel
     * indices of the full volume, origin 0), which holds for the datasets tested
     * so far.
     */
    alignToTracks(scaleSettings: ImagingScaleSettings) {
        this.scaleSettings = scaleSettings;
        this.applyAlignment();
    }

    /** Must run before each render. */
    update() {
        this.syncCamera();
        this.layer?.update();
    }

    private syncCamera() {
        const host = this.options.getCamera();
        const k = 1 / this.worldScale;
        this.camera.copy(host);
        this.camera.position.multiplyScalar(k);
        this.camera.near = host.near * k;
        this.camera.far = host.far * k;
        this.camera.updateProjectionMatrix();
        this.camera.updateMatrixWorld();
    }

    resize() {
        this.layer?.resize();
    }

    dispose() {
        this.setSource(null);
    }

    private applyAlignment() {
        const layer = this.layer;
        // Both inputs arrive independently: scaleSettings from the tracks fetch,
        // the splat axis names only once the scene has loaded.
        if (layer && this.options.align === "fit") {
            if (!this.fitPlacement) {
                // Bounds before any placement, so compute once per scene.
                const box = layer.getBounds();
                if (!box || box.isEmpty()) return;
                const center = box.getCenter(new Vector3());
                const size = box.getSize(new Vector3());
                this.fitPlacement = {
                    matrix: new Matrix4().makeTranslation(-center.x, -center.y, -center.z),
                    scale: 2 / Math.max(size.x, size.y, size.z),
                };
            }
            this.worldScale = this.fitPlacement.scale;
            layer.alignTo(this.fitPlacement.matrix);
            return;
        }
        if (!layer || !this.scaleSettings) return;
        if (this.options.align === "none") {
            // The splats are already in viewer space (a synthetic scene, or one
            // exported pre-normalized); applying the normalization again would
            // shrink them by `extent_xyz` — ~1000x on a real dataset.
            console.debug("[ImagingLayer] alignment disabled");
            return;
        }
        const { meanX, meanY, meanZ, extentXYZ } = this.scaleSettings;
        if (meanX === undefined || meanY === undefined || meanZ === undefined || !extentXYZ) {
            console.warn("[ImagingLayer] tracks have no scale settings; imaging left unaligned");
            return;
        }
        // Translation and axis permutation only; the 1 / extent_xyz scale goes on
        // the camera (see `camera`).
        this.worldScale = 1 / extentXYZ;
        layer.alignTo(trackAlignmentMatrix([meanZ, meanY, meanX], 1, spatialPermutation(layer.getDimensionNames())));
    }

    private applyTime() {
        const layer = this.layer;
        if (!layer || this.time === null) return;
        const dims = layer.getDimensions();
        const t = timeDimension(layer.findDimension("time"), dims?.ndim ?? 0, dims?.displayed ?? []);
        if (t === null) return;
        layer.prefetchDimensionValue(t, this.time + 1);
        void layer.setDimensionValue(t, this.time).catch(() => {
            /* a superseded slice update is normal while scrubbing */
        });
    }
}

/**
 * The affine taking splat centers to inTRACKtive world space.
 *
 * Row i produces world axis i (the data's z, y, x) and reads splat column
 * `perm[i]`, so a scene stored (X, Y, Z) is transposed into place here rather
 * than needing a re-export.
 */
export function trackAlignmentMatrix(
    meanZYX: [number, number, number],
    extentXYZ: number,
    perm: [number, number, number],
): Matrix4 {
    const s = 1 / extentXYZ;
    const e: number[] = new Array(16).fill(0);
    for (let row = 0; row < 3; row++) {
        e[row * 4 + perm[row]] = s;
        e[row * 4 + 3] = -s * meanZYX[row];
    }
    e[15] = 1;
    return new Matrix4().set(...(e as Parameters<Matrix4["set"]>));
}

/**
 * Which splat center column feeds each of inTRACKtive's world axes (z, y, x).
 *
 * Luxar scenes disagree about column order for the same specimen: a fit handed
 * over as (Z, Y, X) may be published as a scene storing (X, Y, Z), and
 * `luxar gsplat convert` names its axes `dim0…dimN`. Guessing wrong yields a
 * transposed worm that still looks like a worm, so read the scene's names and
 * fall back to (z, y, x) only when they say nothing.
 */
export function spatialPermutation(names: string[]): [number, number, number] {
    const perm = ["z", "y", "x"].map((axis) => names.findIndex((n) => n.trim().toLowerCase() === axis));
    if (perm.some((i) => i < 0) || new Set(perm).size !== 3) return [0, 1, 2];
    return perm as [number, number, number];
}

/**
 * Which layer dimension carries time.
 *
 * A name lookup alone is not enough: `luxar gsplat convert` emits anonymous
 * axes, and the failure is silent — the splats freeze on one frame while the
 * tracks play. So fall back to the sole non-displayed dimension, which for a 4D
 * imaging scene is time by construction. With more than one candidate (say time
 * *and* channel) there is no defensible guess, so give up.
 */
export function timeDimension(byName: number | null, ndim: number, displayed: number[]): number | null {
    if (byName !== null) return byName;
    const hidden = [];
    for (let i = 0; i < ndim; i++) if (!displayed.includes(i)) hidden.push(i);
    if (hidden.length !== 1) {
        if (hidden.length > 1)
            console.warn("[ImagingLayer] no 'time' dimension and %d candidates; time sync off", hidden.length);
        return null;
    }
    return hidden[0];
}
