/**
 * This class gives a specific type for the Track object, but it's mostly a
 * Mesh with a custom initializer.
 *
 * see:
 *  https://github.com/mrdoob/three.js/blob/5ed5417d63e4eeba5087437cc27ab1e3d0813aea/examples/jsm/lines/Line2.js
 *  https://github.com/mrdoob/three.js/blob/5ed5417d63e4eeba5087437cc27ab1e3d0813aea/examples/jsm/lines/LineSegments2.js
 */
import { Mesh } from "three";

import { TrackGeometry } from "./TrackGeometry.js";
import { TrackMaterial } from "./TrackMaterial.js";

export class Track extends Mesh {
    isTrack = true;
    type = "Track";
    declare geometry: TrackGeometry;
    declare material: TrackMaterial;

    static new(positions: Float32Array, pointIDs: Int32Array, maxPointsPerTimepoint: number) {
        const geometry = new TrackGeometry();
        const material = new TrackMaterial({
            vertexColors: true,
            trackwidth: 0.3,
            highlightwidth: 2.0,
            showtrack: true,
            showhighlight: true,
            transparent: true,
            opacity: 0.5,
        });
        const track = new Track(geometry, material);

        const time: number[] = [];
        const pos = Array.from(positions);
        const colors: number[] = [];
        const n = pos.length / 3;
        for (const [i, id] of pointIDs.entries()) {
            const t = Math.floor(id / maxPointsPerTimepoint);
            time.push(t);
            // TODO: use a LUT for the main track, too
            colors.push(((0.9 * (n - i)) / n) ** 3, ((0.9 * (n - i)) / n) ** 3, (0.9 * (n - i)) / n);
        }

        // if this track has a single point, in order to keep this point in our data,
        // we are using the point as both the start and end of the line segment
        if (pos.length === 3) {
            pos.push(pos[0], pos[1], pos[2]);
            colors.push(colors[0], colors[1], colors[2]);
            time.push(time[0]);
        }

        track.geometry.setPositions(pos);
        track.geometry.setColors(colors);
        track.geometry.setTime(time);
        track.geometry.computeBoundingSphere();
        return track;
    }

    updateAppearance(showTrack: boolean, showHighlight: boolean, minTime: number, maxTime: number) {
        this.material.showtrack = showTrack;
        this.material.showhighlight = showHighlight;
        this.material.minTime = minTime;
        this.material.maxTime = maxTime;
        this.material.needsUpdate = true;
    }

    dispose() {
        this.geometry.dispose();
        this.material.dispose();
    }
}
