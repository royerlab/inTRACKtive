/**
 * This class maintains the geometry of the track, adding instanced attributes for time.
 * see:
 *  https://github.com/mrdoob/three.js/blob/dev/examples/jsm/lines/LineGeometry.js
 */
import { InstancedInterleavedBuffer, InterleavedBufferAttribute } from "three";
import { LineSegmentsGeometry } from "three/examples/jsm/Addons.js";

class TrackGeometry extends LineSegmentsGeometry {
    isTrackGeometry = true;
    type = "TrackGeometry";

    setPositions(array: number[] | Float32Array) {
        // converts [ x1, y1, z1, x2, y2, z2, ... ] to pairs format

        const length = array.length - 3;

        // if array.length === 3, then this track has a single point
        // in order to keep this point in our data, we are using the point as both the start and end
        // Initialize the points array with a minimum of 6 to store a single point and larger if there
        // are more points in the input array
        const points = new Float32Array(Math.max(3, 2 * length)); // start and end of each line

        if (array.length === 3) {
            console.log({ array });
            points[0] = array[0];
            points[1] = array[1];
            points[2] = array[2];
            points[3] = array[0];
            points[4] = array[1];
            points[5] = array[2];
        } else {
            for (let i = 0; i < length; i += 3) {
                // start point
                points[2 * i] = array[i];
                points[2 * i + 1] = array[i + 1];
                points[2 * i + 2] = array[i + 2];
                // end point
                points[2 * i + 3] = array[i + 3];
                points[2 * i + 4] = array[i + 4];
                points[2 * i + 5] = array[i + 5];
            }
        }

        super.setPositions(points);

        return this;
    }

    setColors(array: number[] | Float32Array) {
        // converts [ r1, g1, b1, r2, g2, b2, ... ] to pairs format

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

    setTime(array: number[]) {
        // TRACK SPECIFIC CODE ADDED
        // converts [ t1, t2, ... ] to pairs format
        // this ecodes the timepoint of each point in the track
        // this can be used in shaders to highlight specific segments in the
        // track based on time

        // float32 should be sufficient given we're expecting ~1000 timepoints
        const length = array.length - 1;

        // if array.length === 1, then this track has a single point
        // in order to keep this point in our data, we are using the point as both the start and end
        // Initialize the times array with a minimum of 2 to store a single point and larger if there
        // are more times in the input array
        const times = new Float32Array(Math.max(2, 2 * length));

        if (array.length === 1) {
            times[0] = array[0];
            times[1] = array[0];
        } else {
            for (let i = 0; i < length; i++) {
                times[2 * i] = array[i];
                times[2 * i + 1] = array[i + 1];
            }
        }

        const time = new InstancedInterleavedBuffer(times, 2, 1);
        this.setAttribute("instanceTimeStart", new InterleavedBufferAttribute(time, 1, 0));
        this.setAttribute("instanceTimeEnd", new InterleavedBufferAttribute(time, 1, 1));

        return this;
    }
}

export { TrackGeometry };
