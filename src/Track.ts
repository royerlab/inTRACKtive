import { TrackLine } from "./lib/three/TrackLine.ts";
import { TrackGeometry } from "./lib/three/TrackGeometry.ts";
import { TrackMaterial } from "./lib/three/TrackMaterial.ts";
import { Lut } from "three/examples/jsm/math/Lut.js";
import { DataTexture, RGBAFormat, SRGBColorSpace, UnsignedByteType } from "three";

export class Track {
    trackID: number;

    positions: Float32Array;
    pointIDs: Int32Array;

    trackLine: TrackLine;

    constructor(trackID: number, positions: Float32Array, pointIDs: Int32Array, maxPointsPerTimepoint: number) {
        this.trackID = trackID;
        this.positions = positions;
        this.pointIDs = pointIDs;

        const geometry = new TrackGeometry();
        const material = new TrackMaterial({
            vertexColors: true,
            trackwidth: 0.3,
            highlightwidth: 2.0,
            highlightLUT: highlightLUTTexture,
            showtrack: true,
            transparent: true,
            opacity: 0.5,
        });
        this.trackLine = new TrackLine(geometry, material);

        const time: number[] = [];
        const pos = Array.from(this.positions);
        const colors: number[] = [];
        const n = pos.length / 3;
        for (const [i, id] of this.pointIDs.entries()) {
            const t = Math.floor(id / maxPointsPerTimepoint);
            time.push(t);
            // TODO: use a LUT for the main track, too
            colors.push(((0.9 * (n - i)) / n) ** 3, ((0.9 * (n - i)) / n) ** 3, (0.9 * (n - i)) / n);
        }
        this.trackLine.geometry.setPositions(pos);
        this.trackLine.geometry.setColors(colors);
        this.trackLine.geometry.setTime(time);
        this.trackLine.geometry.computeBoundingSphere();
    }

    updateHighlightLine(minTime: number, maxTime: number) {
        if (this.trackLine) {
            this.trackLine.material.minTime = minTime;
            this.trackLine.material.maxTime = maxTime;
            this.trackLine.material.needsUpdate = true;
        }
        return;
    }

    dispose() {
        if (this.trackLine) {
            this.trackLine.geometry.dispose();
            if (Array.isArray(this.trackLine.material)) {
                for (const material of this.trackLine.material) {
                    material.dispose();
                }
            } else {
                this.trackLine.material.dispose();
            }
        }
    }
}

const highlightLUT = new Lut();
// generated using https://waldyrious.net/viridis-palette-generator/
highlightLUT.addColorMap("plasma", [
    [0.0, 0x000004],
    [0.1, 0x160b39],
    [0.2, 0x420a68],
    [0.3, 0x6a176e],
    [0.4, 0x932667],
    [0.5, 0xbc3754],
    [0.6, 0xdd513a],
    [0.7, 0xf37819],
    [0.8, 0xfca50a],
    [0.9, 0xf6d746],
    [1.0, 0xfcffa4],
]);
highlightLUT.setColorMap("plasma");
const lutArray = new Uint8Array(128 * 4);
for (let i = 0; i < 128; i++) {
    const color = highlightLUT.getColor(i / 128);
    lutArray[i * 4] = color.r * 255;
    lutArray[i * 4 + 1] = color.g * 255;
    lutArray[i * 4 + 2] = color.b * 255;
    lutArray[i * 4 + 3] = 255;
}
const highlightLUTTexture = new DataTexture(lutArray, 128, 1, RGBAFormat, UnsignedByteType);
highlightLUTTexture.colorSpace = SRGBColorSpace;
highlightLUTTexture.needsUpdate = true;
