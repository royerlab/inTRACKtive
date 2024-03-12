import { InstancedInterleavedBuffer, InterleavedBufferAttribute, Line } from "three";
import { LineSegmentsGeometry } from "three/examples/jsm/Addons.js";

class TrackGeometry extends LineSegmentsGeometry {
    isTrackGeometry = true;
    tupe = "TrackGeometry";

    constructor() {
        super();
    }

    setPositions(array: number[] | Float32Array) {
        // converts [ x1, y1, z1,  x2, y2, z2, ... ] to pairs format

        const length = array.length - 3;
        const points = new Float32Array(2 * length);

        for (let i = 0; i < length; i += 3) {
            points[2 * i] = array[i];
            points[2 * i + 1] = array[i + 1];
            points[2 * i + 2] = array[i + 2];

            points[2 * i + 3] = array[i + 3];
            points[2 * i + 4] = array[i + 4];
            points[2 * i + 5] = array[i + 5];
        }

        super.setPositions(points);

        return this;
    }

    setColors(array: number[] | Float32Array) {
        // converts [ r1, g1, b1,  r2, g2, b2, ... ] to pairs format

        const length = array.length - 3;
        const colors = new Float32Array(2 * length);

        for (let i = 0; i < length; i += 3) {
            colors[2 * i] = array[i];
            colors[2 * i + 1] = array[i + 1];
            colors[2 * i + 2] = array[i + 2];

            colors[2 * i + 3] = array[i + 3];
            colors[2 * i + 4] = array[i + 4];
            colors[2 * i + 5] = array[i + 5];
        }

        super.setColors(colors);

        return this;
    }

    setTime(array: number[] | Int32Array) {
        // converts [ t1, t2, ... ] to pairs format

        const length = array.length - 1;
        const times = new Float32Array(2 * length);

        for (let i = 0; i < length; i++) {
            times[2 * i] = array[i];
            times[2 * i + 1] = array[i + 1];
        }

        const time = new InstancedInterleavedBuffer(times, 2, 1);
        this.setAttribute("instanceTimeStart", new InterleavedBufferAttribute(time, 1, 0));
        this.setAttribute("instanceTimeEnd", new InterleavedBufferAttribute(time, 1, 1));

        return this;
    }

    fromLine(line: Line) {
        const geometry = line.geometry;

        this.setPositions(geometry.attributes.position.array as Float32Array); // assumes non-indexed

        // set colors, maybe

        return this;
    }
}

export { TrackGeometry };
