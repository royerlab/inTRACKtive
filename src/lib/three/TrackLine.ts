import { TrackGeometry } from "./TrackGeometry.js";
import { TrackMaterial } from "./TrackMaterial.js";
import { Mesh } from "three";

/**
 * This class just gives us a specific type for the TrackLine object.
 *
 * see:
 *  https://github.com/mrdoob/three.js/blob/5ed5417d63e4eeba5087437cc27ab1e3d0813aea/examples/jsm/lines/Line2.js
 *  https://github.com/mrdoob/three.js/blob/5ed5417d63e4eeba5087437cc27ab1e3d0813aea/examples/jsm/lines/LineSegments2.js
 */

export class TrackLine extends Mesh {
    isTrack = true;
    type = "Track";
    declare geometry: TrackGeometry;
    declare material: TrackMaterial;

    constructor(geometry: TrackGeometry, material: TrackMaterial) {
        super(geometry, material);
    }
}
