/**
 * THROWAWAY — Gate 0b of the Luxar-layer spike.
 *
 * Stands in for a Luxar gsplat node without any Luxar code: an emissive,
 * additively-blended, depth-write-disabled point cloud with a Gaussian falloff
 * sprite, living in the same unit-ish box inTRACKtive normalizes its cells into.
 *
 * The point is to find out how splat-like geometry behaves inside inTRACKtive's
 * existing pipeline — UnrealBloomPass, FogExp2, draw order against the opaque
 * cell points, and the camera's near plane — before committing to a shared
 * canvas. Delete this file (and its call site in PointCanvas) once answered.
 *
 * Enable with `?fakesplats` in the URL. `?fakesplats=N` sets the count.
 */
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial } from "three";

const vertexShader = `
    attribute float size;
    attribute vec3 color;
    varying vec3 vColor;
    void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

// Gaussian falloff, so each sprite reads like a projected splat rather than a
// hard disc. Emissive: no lighting term, same as Luxar's non-mesh geometry.
const fragmentShader = `
    varying vec3 vColor;
    void main() {
        vec2 d = gl_PointCoord - vec2(0.5);
        float r2 = dot(d, d) * 4.0;
        if (r2 > 1.0) discard;
        float a = exp(-3.0 * r2);
        gl_FragColor = vec4(vColor * a, a);
    }
`;

// Deterministic PRNG so successive screenshots are comparable.
function mulberry32(seed: number) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function makeFakeSplats(count = 40000, gain = 1): Points {
    const rand = mulberry32(1234);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        // A filled ball of radius ~0.8, i.e. interleaved with the cells rather
        // than sitting behind them — the hard case for draw order.
        let x = 0;
        let y = 0;
        let z = 0;
        let r2 = 2;
        while (r2 > 1) {
            x = rand() * 2 - 1;
            y = rand() * 2 - 1;
            z = rand() * 2 - 1;
            r2 = x * x + y * y + z * z;
        }
        const shell = 0.8;
        positions[i * 3] = x * shell;
        positions[i * 3 + 1] = y * shell;
        positions[i * 3 + 2] = z * shell;

        // Warm amber, deliberately unlike the cyan cells so overlap is legible.
        const t = (0.35 + 0.65 * (1 - r2)) * gain;
        colors[i * 3] = 1.0 * t;
        colors[i * 3 + 1] = 0.55 * t;
        colors[i * 3 + 2] = 0.15 * t;

        sizes[i] = 0.02 + rand() * 0.05;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    geometry.setAttribute("size", new Float32BufferAttribute(sizes, 1));

    const material = new ShaderMaterial({
        vertexShader,
        fragmentShader,
        // How Luxar draws its emissive geometry: additive, no depth write, but
        // still depth-tested against opaque geometry.
        blending: AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        transparent: true,
        // NOTE: `fog: true` is deliberately NOT set — Luxar's materials do not
        // compile fog support either, so this reproduces the mismatch against
        // inTRACKtive's FogExp2 scene.
    });

    const points = new Points(geometry, material);
    points.name = "fake-splats";
    // Draw after the opaque cells so additive blending lands on top of them.
    points.renderOrder = 10;
    return points;
}
