/* @ts-self-types="./luxar_wasm.d.ts" */

/**
 * Calculate effective radii for nD points when sliced.
 *
 * For each point, computes the effective radius visible in the 3D slice
 * based on the point's distance from the slice plane in hidden dimensions.
 *
 * # Arguments
 * * `positions` - Point positions [numPoints * ndim] (flattened nD coordinates)
 * * `radii` - Original point radii [numPoints]
 * * `display_dims` - Dimensions to display (typically first 3) [numDisplayDims]
 * * `slice_position` - Current slice position [ndim]
 * * `spatial_extend_dims` - Which dims are spatial (1) vs discrete (0) [ndim]
 * * `ndim` - Total number of dimensions (max 16)
 * * `num_points` - Number of points
 * * `output` - Output effective radii [numPoints]
 *
 * # Returns
 * Number of points with non-zero effective radius (visible points)
 *
 * # Algorithm
 * For each point:
 * 1. Check discrete dimension match (exact or within tolerance)
 * 2. Calculate squared distance in non-displayed spatial dimensions
 * 3. Apply Pythagorean theorem: R_effective = sqrt(R² - D²)
 * 4. Set R_effective = 0 if point is outside original radius
 *
 * # Panics
 * Panics if `ndim > 16`. Use TypeScript fallback for higher dimensions.
 * @param {Float32Array} positions
 * @param {Float32Array} radii
 * @param {Uint32Array} display_dims
 * @param {Float32Array} slice_position
 * @param {Uint8Array} spatial_extend_dims
 * @param {number} ndim
 * @param {number} num_points
 * @param {Float32Array} output
 * @returns {number}
 */
export function calculate_effective_radii(positions, radii, display_dims, slice_position, spatial_extend_dims, ndim, num_points, output) {
    const ptr0 = passArrayF32ToWasm0(positions, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(radii, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray32ToWasm0(display_dims, wasm.__wbindgen_export);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF32ToWasm0(slice_position, wasm.__wbindgen_export);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArray8ToWasm0(spatial_extend_dims, wasm.__wbindgen_export);
    const len4 = WASM_VECTOR_LEN;
    var ptr5 = passArrayF32ToWasm0(output, wasm.__wbindgen_export);
    var len5 = WASM_VECTOR_LEN;
    const ret = wasm.calculate_effective_radii(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ndim, num_points, ptr5, len5, addHeapObject(output));
    return ret >>> 0;
}

/**
 * Calculate 3D segment lengths for visible segments.
 *
 * # Arguments
 * - `start_positions`: Clipped start positions [visibleCount * 3]
 * - `end_positions`: Clipped end positions [visibleCount * 3]
 * - `visible_count`: Number of visible segments
 * - `output`: Output segment lengths [visibleCount]
 * @param {Float32Array} start_positions
 * @param {Float32Array} end_positions
 * @param {number} visible_count
 * @param {Float32Array} output
 */
export function calculate_segment_lengths(start_positions, end_positions, visible_count, output) {
    const ptr0 = passArrayF32ToWasm0(start_positions, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(end_positions, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    var ptr2 = passArrayF32ToWasm0(output, wasm.__wbindgen_export);
    var len2 = WASM_VECTOR_LEN;
    wasm.calculate_segment_lengths(ptr0, len0, ptr1, len1, visible_count, ptr2, len2, addHeapObject(output));
}

/**
 * Clip a single segment to the nD slice and return interpolation parameters.
 *
 * Returns (visible, t1, t2) where:
 * - visible: true if any part of segment intersects slice
 * - t1: interpolation parameter for clipped start (0.0 = original start)
 * - t2: interpolation parameter for clipped end (1.0 = original end)
 *
 * The clipped points can be computed as:
 * - clipped_p1 = p1 + t1 * (p2 - p1)
 * - clipped_p2 = p1 + t2 * (p2 - p1)
 * @param {Float32Array} p1
 * @param {Float32Array} p2
 * @param {Float32Array} slice_position
 * @param {Float32Array} tolerance
 * @param {Uint32Array} display_dims
 * @param {number} ndim
 * @returns {Float32Array}
 */
export function clip_segment_single(p1, p2, slice_position, tolerance, display_dims, ndim) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArrayF32ToWasm0(p1, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF32ToWasm0(p2, wasm.__wbindgen_export);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArrayF32ToWasm0(slice_position, wasm.__wbindgen_export);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArrayF32ToWasm0(tolerance, wasm.__wbindgen_export);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passArray32ToWasm0(display_dims, wasm.__wbindgen_export);
        const len4 = WASM_VECTOR_LEN;
        wasm.clip_segment_single(retptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ndim);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v6 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export2(r0, r1 * 4, 4);
        return v6;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Batch clip all segments and output visibility mask and interpolation parameters.
 *
 * This is the main workhorse function - processes all segments in one WASM call.
 *
 * # Arguments
 * - `positions`: Vertex positions [numVertices * ndim]
 * - `segments`: Segment indices [numSegments * 2]
 * - `slice_position`: Current slice position [ndim]
 * - `tolerance`: Per-dimension tolerance [ndim]
 * - `display_dims`: Which dimensions to display [numDisplayDims]
 * - `ndim`: Number of dimensions
 * - `num_segments`: Number of segments
 * - `output_visibility`: Output visibility mask [numSegments]
 * - `output_t1`: Output t1 parameters [numSegments]
 * - `output_t2`: Output t2 parameters [numSegments]
 *
 * # Returns
 * Number of visible segments
 * @param {Float32Array} positions
 * @param {Uint32Array} segments
 * @param {Float32Array} slice_position
 * @param {Float32Array} tolerance
 * @param {Uint32Array} display_dims
 * @param {number} ndim
 * @param {number} num_segments
 * @param {Uint8Array} output_visibility
 * @param {Float32Array} output_t1
 * @param {Float32Array} output_t2
 * @returns {number}
 */
export function clip_segments_batch(positions, segments, slice_position, tolerance, display_dims, ndim, num_segments, output_visibility, output_t1, output_t2) {
    const ptr0 = passArrayF32ToWasm0(positions, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray32ToWasm0(segments, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF32ToWasm0(slice_position, wasm.__wbindgen_export);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF32ToWasm0(tolerance, wasm.__wbindgen_export);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArray32ToWasm0(display_dims, wasm.__wbindgen_export);
    const len4 = WASM_VECTOR_LEN;
    var ptr5 = passArray8ToWasm0(output_visibility, wasm.__wbindgen_export);
    var len5 = WASM_VECTOR_LEN;
    var ptr6 = passArrayF32ToWasm0(output_t1, wasm.__wbindgen_export);
    var len6 = WASM_VECTOR_LEN;
    var ptr7 = passArrayF32ToWasm0(output_t2, wasm.__wbindgen_export);
    var len7 = WASM_VECTOR_LEN;
    const ret = wasm.clip_segments_batch(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ndim, num_segments, ptr5, len5, addHeapObject(output_visibility), ptr6, len6, addHeapObject(output_t1), ptr7, len7, addHeapObject(output_t2));
    return ret >>> 0;
}

/**
 * Compact `faces` to those whose three vertices are all visible.
 *
 * Writes **original (un-remapped)** vertex indices into `output` — see the
 * "No vertex compaction" note in the module docs.
 *
 * # Winding
 *
 * The authored per-face index order is preserved exactly, so this kernel is
 * winding-agnostic. Restoring front-facing winding under a reflected display
 * permutation is a separate post-pass owned by the caller (§5.4).
 *
 * # Out-of-range indices
 *
 * A face index `>= vertex_mask.len()` causes the whole face to be **dropped**
 * rather than indexing out of bounds.
 *
 * This guard exists because the values come from the *store*, not from the
 * caller: the viewer loads arbitrary (externally produced, possibly corrupted)
 * datasets, and an out-of-bounds slice read here would not be a node-scoped
 * error — the crate is `panic = "abort"`, so the trap escapes as an opaque,
 * uncatchable `RuntimeError: unreachable`, and the trapped instance carries no
 * state guarantees afterwards. The TypeScript backend would instead read
 * `undefined` and silently diverge. Dropping the face keeps both backends in
 * parity and fails safe.
 *
 * The loader validates face indices up front and fails the node with a
 * `LoaderError` before reaching here (§3.5 Stage 2), so on the sanctioned path
 * this guard is unreachable. It is defense in depth for a `panic = "abort"`
 * blast radius, not a substitute for that gate.
 *
 * Note the asymmetry with the `debug_assert`s above, which is deliberate:
 * store-supplied *values* are range-checked in release builds, while *shape*
 * parameters (`num_faces`, buffer sizes) the caller computed are trusted, as
 * they were in every sibling kernel (e.g. the former `compact_by_mask` /
 * `count_visible`).
 *
 * # Arguments
 * * `faces` - Triangle vertex indices [num_faces * 3]
 * * `vertex_mask` - Per-vertex visibility from
 *   [`mesh_vertex_visibility_mask`]; its **length defines the valid vertex
 *   range**, so pass a view sized exactly `num_vertices` rather than a larger
 *   reused scratch buffer
 * * `num_faces` - Number of triangles
 * * `output` - Output indices [num_faces * 3] worst case
 *
 * # Returns
 *
 * Number of visible faces written. **Slice `output` to `3 ×` this before use.**
 * Everything past that point is left untouched — deliberately, to avoid a second
 * pass over the buffer — so on a reused buffer it holds the *previous* frame's
 * indices, and on a fresh one it holds zeros. Uploading the whole buffer as an
 * index range therefore draws stale or degenerate triangles rather than
 * nothing, which is the failure this return value exists to prevent.
 * @param {Uint32Array} faces
 * @param {Uint8Array} vertex_mask
 * @param {number} num_faces
 * @param {Uint32Array} output
 * @returns {number}
 */
export function compact_visible_faces(faces, vertex_mask, num_faces, output) {
    const ptr0 = passArray32ToWasm0(faces, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(vertex_mask, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    var ptr2 = passArray32ToWasm0(output, wasm.__wbindgen_export);
    var len2 = WASM_VECTOR_LEN;
    const ret = wasm.compact_visible_faces(ptr0, len0, ptr1, len1, num_faces, ptr2, len2, addHeapObject(output));
    return ret >>> 0;
}

/**
 * Per-endpoint **joint code**: how the line shader should treat this endpoint,
 * and — when it is an ordinary two-segment joint — which segment it joins.
 *
 * One f32 per endpoint, in the two texel slots that used to carry the cap
 * suppression scalar:
 *
 * | value          | meaning                                                     |
 * |----------------|-------------------------------------------------------------|
 * | ` 0`           | free polyline end — keep the soft cap                        |
 * | `-1`           | slice-clipped — the real endpoint is outside the slice, so no |
 * |                | neighbour will ever arrive; suppress the cap entirely        |
 * | `-2`           | degree->=3 hub — several quads already stack here            |
 * | `+(slot + 1)`  | joins visible segment `slot`, at that segment's START        |
 * | `-(slot + 3)`  | joins visible segment `slot`, at that segment's END          |
 *
 * `slot` is the segment's index in the VISIBLE (output) stream, i.e. its
 * storage slot in the line texture. The shader's own `aSortedIndex` maps a
 * DRAW slot to a storage slot, so a storage-space partner reference is read
 * directly and needs no adjustment when the depth-sort worker permutes draw
 * order.
 *
 * # Why a code and not an angle
 *
 * The previous kernel dereferenced the partner only to take one dot product of
 * the two segment directions, and stored `cos(theta)` as a cap-suppression
 * scalar. Storing the partner instead lets the vertex stage do that itself,
 * which buys three things:
 *
 * - The bend angle is measured in SCREEN space, per frame, so it tracks the
 *   camera. The stored angle could not: a gentle 3D bend that projected sharp
 *   kept suppression near 1 while the quads genuinely overlapped (issue #795).
 * - The vertex stage can build real join geometry (a screen-space miter),
 *   which closes the uncovered wedge outside every bend (issue #790) — a
 *   scalar multiplier never could, because there are no fragments there.
 * - This kernel loses its direction table entirely: no per-segment normalize,
 *   no `dirs` allocation (12 B per visible segment — ~32 MB on the largest
 *   bundled lines scene, on wasm linear memory that is never returned to the
 *   OS), and no f64-vs-f32 care to keep the two backends bit-identical, since
 *   integer index arithmetic agrees trivially.
 *
 * The fallback the shader derives is exactly the old value:
 * `clamp(-dot(away_a, away_b), 0, 1)` with each `away` pointing from the
 * shared vertex back along its segment reduces to
 * `clamp(dot(dir_mine, dir_partner), 0, 1)` — the same dot product the miter
 * limit needs anyway.
 *
 * # Joint recognition
 *
 * Only **degree-2** vertices become joints; a hub keeps the cap. A joint is
 * recognised only between two endpoints that both actually *reach* the shared
 * vertex, so a culled or slice-trimmed neighbour does not anchor one.
 *
 * Joints are matched by vertex **index**, not by position. A chain whose
 * segments each carry their own duplicate copy of the shared point (what
 * `line_type="segments"` emits for abutting segments) has no shared index, so
 * it keeps the cap at every joint. That is deliberate: a shared index means
 * "the same vertex of the same polyline", whereas position matching would also
 * fuse two unrelated lines that merely touch. Author connected geometry as
 * `line_type="polyline"` (or reuse indices) to get continuous joints.
 *
 * # Cost
 *
 * Two vertex-indexed tables, 5 B per source vertex (`code_sum` + `degree`),
 * and no per-segment allocation at all.
 *
 * # Arguments
 * - `segments`: Vertex index pairs [numSegments * 2]
 * - `visibility`: Visibility mask [numSegments]
 * - `t1_params`: Start interpolation parameters [numSegments]
 * - `t2_params`: End interpolation parameters [numSegments]
 * - `num_segments`: Total number of segments
 * - `num_vertices`: Total number of source vertices (bounds the touch tables)
 * - `output_start`: Output start joint codes [visibleCount]
 * - `output_end`: Output end joint codes [visibleCount]
 *
 * # Returns
 * Number of visible segments written
 * @param {Uint32Array} segments
 * @param {Uint8Array} visibility
 * @param {Float32Array} t1_params
 * @param {Float32Array} t2_params
 * @param {number} num_segments
 * @param {number} num_vertices
 * @param {Float32Array} output_start
 * @param {Float32Array} output_end
 * @returns {number}
 */
export function compute_joint_codes(segments, visibility, t1_params, t2_params, num_segments, num_vertices, output_start, output_end) {
    const ptr0 = passArray32ToWasm0(segments, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(visibility, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF32ToWasm0(t1_params, wasm.__wbindgen_export);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF32ToWasm0(t2_params, wasm.__wbindgen_export);
    const len3 = WASM_VECTOR_LEN;
    var ptr4 = passArrayF32ToWasm0(output_start, wasm.__wbindgen_export);
    var len4 = WASM_VECTOR_LEN;
    var ptr5 = passArrayF32ToWasm0(output_end, wasm.__wbindgen_export);
    var len5 = WASM_VECTOR_LEN;
    const ret = wasm.compute_joint_codes(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, num_segments, num_vertices, ptr4, len4, addHeapObject(output_start), ptr5, len5, addHeapObject(output_end));
    return ret >>> 0;
}

/**
 * Broadcast a value to all points.
 *
 * Strict contract (mirrors `wasm/typescript/decode.ts::decode_broadcasted`):
 * `value.len()` must be either `1` (a scalar broadcast to every slot) or
 * exactly `elements_per_point` (a per-element vector replicated across every
 * point). Any other length is INVALID and rejected upstream by the worker
 * wrapper (`workers/data-worker/decode/broadcasted.ts`) with a catchable error
 * before this kernel is reached. The old "mixed broadcast" pad/truncate
 * fallback (e.g. `value=[v0,v1], epp=3 -> [v0,v1,v0]`) was removed because it
 * silently diverged from the TS reference.
 *
 * # Arguments
 * * `value` - `1` value (scalar) or `elements_per_point` values (vector)
 * * `num_points` - Number of points
 * * `elements_per_point` - Elements per point (1 for scalar, 3 for vec3, etc.)
 * * `output` - Output buffer [num_points * elements_per_point]
 * @param {Float32Array} value
 * @param {number} num_points
 * @param {number} elements_per_point
 * @param {Float32Array} output
 */
export function decode_broadcasted(value, num_points, elements_per_point, output) {
    const ptr0 = passArrayF32ToWasm0(value, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = passArrayF32ToWasm0(output, wasm.__wbindgen_export);
    var len1 = WASM_VECTOR_LEN;
    wasm.decode_broadcasted(ptr0, len0, num_points, elements_per_point, ptr1, len1, addHeapObject(output));
}

/**
 * Decode per-channel TRUE-log uint16 codes to float32.
 * @param {Uint16Array} data
 * @param {Float64Array} col_lo
 * @param {Float64Array} col_hi
 * @param {number} col_offset
 * @param {Float32Array} output
 */
export function decode_geolog_perchannel_u16(data, col_lo, col_hi, col_offset, output) {
    const ptr0 = passArray16ToWasm0(data, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(col_lo, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(col_hi, wasm.__wbindgen_export);
    const len2 = WASM_VECTOR_LEN;
    var ptr3 = passArrayF32ToWasm0(output, wasm.__wbindgen_export);
    var len3 = WASM_VECTOR_LEN;
    wasm.decode_geolog_perchannel_u16(ptr0, len0, ptr1, len1, ptr2, len2, col_offset, ptr3, len3, addHeapObject(output));
}

/**
 * Decode per-channel TRUE-log uint8 codes to float32 (`x = exp(y)`).
 *
 * The HDR-color encoding: per-column min/max-anchored geometric grid in
 * log space (`col_lo`/`col_hi` are ln(min+)/ln(max+)), uniform relative
 * precision across each column's dynamic range. The reserved zero level is
 * part of this encoding's NAME contract (no legacy variant), so there is
 * no `zero_level` parameter — it is always on.
 * @param {Uint8Array} data
 * @param {Float64Array} col_lo
 * @param {Float64Array} col_hi
 * @param {number} col_offset
 * @param {Float32Array} output
 */
export function decode_geolog_perchannel_u8(data, col_lo, col_hi, col_offset, output) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(col_lo, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(col_hi, wasm.__wbindgen_export);
    const len2 = WASM_VECTOR_LEN;
    var ptr3 = passArrayF32ToWasm0(output, wasm.__wbindgen_export);
    var len3 = WASM_VECTOR_LEN;
    wasm.decode_geolog_perchannel_u8(ptr0, len0, ptr1, len1, ptr2, len2, col_offset, ptr3, len3, addHeapObject(output));
}

/**
 * Decode geometric-log quantized uint16 data to float32.
 * @param {Uint16Array} data
 * @param {number} min_log
 * @param {number} max_log
 * @param {Float32Array} output
 */
export function decode_geolog_scalar_u16(data, min_log, max_log, output) {
    const ptr0 = passArray16ToWasm0(data, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = passArrayF32ToWasm0(output, wasm.__wbindgen_export);
    var len1 = WASM_VECTOR_LEN;
    wasm.decode_geolog_scalar_u16(ptr0, len0, min_log, max_log, ptr1, len1, addHeapObject(output));
}

/**
 * Decode geometric-log quantized uint8 data to float32.
 *
 * Min/max-anchored true-log quantization with a RESERVED ZERO LEVEL:
 * level 0 decodes to exactly 0.0; levels [1, 255] decode to
 * `exp(min_log + (u - 1)/254 * (max_log - min_log))` — uniform relative
 * precision over the array's own nonzero range. Mirrors the TS reference
 * bit-for-bit; Python's f64 decoder can differ because its anchors are not
 * rounded to f32 first.
 * @param {Uint8Array} data
 * @param {number} min_log
 * @param {number} max_log
 * @param {Float32Array} output
 */
export function decode_geolog_scalar_u8(data, min_log, max_log, output) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = passArrayF32ToWasm0(output, wasm.__wbindgen_export);
    var len1 = WASM_VECTOR_LEN;
    wasm.decode_geolog_scalar_u8(ptr0, len0, min_log, max_log, ptr1, len1, addHeapObject(output));
}

/**
 * Decode per-channel LINEAR (fixed-point) uint16 codes to float32.
 * @param {Uint16Array} data
 * @param {Float64Array} col_lo
 * @param {Float64Array} col_hi
 * @param {number} col_offset
 * @param {Float32Array} output
 */
export function decode_linear_perchannel_u16(data, col_lo, col_hi, col_offset, output) {
    const ptr0 = passArray16ToWasm0(data, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(col_lo, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(col_hi, wasm.__wbindgen_export);
    const len2 = WASM_VECTOR_LEN;
    var ptr3 = passArrayF32ToWasm0(output, wasm.__wbindgen_export);
    var len3 = WASM_VECTOR_LEN;
    wasm.decode_linear_perchannel_u16(ptr0, len0, ptr1, len1, ptr2, len2, col_offset, ptr3, len3, addHeapObject(output));
}

/**
 * Decode per-channel LINEAR (fixed-point) uint8 codes to float32.
 *
 * Identity transform with per-column `[lo, hi]` scales — the COORDINATE
 * encoding (positions / centers / vertices). No reserved zero level (mirrors
 * the Python `_decode_linear_perchannel`, which has no `zero_level` branch).
 * @param {Uint8Array} data
 * @param {Float64Array} col_lo
 * @param {Float64Array} col_hi
 * @param {number} col_offset
 * @param {Float32Array} output
 */
export function decode_linear_perchannel_u8(data, col_lo, col_hi, col_offset, output) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(col_lo, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(col_hi, wasm.__wbindgen_export);
    const len2 = WASM_VECTOR_LEN;
    var ptr3 = passArrayF32ToWasm0(output, wasm.__wbindgen_export);
    var len3 = WASM_VECTOR_LEN;
    wasm.decode_linear_perchannel_u8(ptr0, len0, ptr1, len1, ptr2, len2, col_offset, ptr3, len3, addHeapObject(output));
}

/**
 * Decode per-channel LOG uint16 codes to float32.
 * @param {Uint16Array} data
 * @param {Float64Array} col_lo
 * @param {Float64Array} col_hi
 * @param {boolean} zero_level
 * @param {number} col_offset
 * @param {Float32Array} output
 */
export function decode_log_perchannel_u16(data, col_lo, col_hi, zero_level, col_offset, output) {
    const ptr0 = passArray16ToWasm0(data, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(col_lo, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(col_hi, wasm.__wbindgen_export);
    const len2 = WASM_VECTOR_LEN;
    var ptr3 = passArrayF32ToWasm0(output, wasm.__wbindgen_export);
    var len3 = WASM_VECTOR_LEN;
    wasm.decode_log_perchannel_u16(ptr0, len0, ptr1, len1, ptr2, len2, zero_level, col_offset, ptr3, len3, addHeapObject(output));
}

/**
 * Decode per-channel LOG uint8 codes to float32 (`x = expm1(y)`).
 *
 * The Cholesky-diagonal encoding. `zero_level: true` (current writer) =
 * reserved zero code + nonzero codes over the nonzero-anchored scale;
 * `false` = legacy all-levels mapping.
 * @param {Uint8Array} data
 * @param {Float64Array} col_lo
 * @param {Float64Array} col_hi
 * @param {boolean} zero_level
 * @param {number} col_offset
 * @param {Float32Array} output
 */
export function decode_log_perchannel_u8(data, col_lo, col_hi, zero_level, col_offset, output) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(col_lo, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(col_hi, wasm.__wbindgen_export);
    const len2 = WASM_VECTOR_LEN;
    var ptr3 = passArrayF32ToWasm0(output, wasm.__wbindgen_export);
    var len3 = WASM_VECTOR_LEN;
    wasm.decode_log_perchannel_u8(ptr0, len0, ptr1, len1, ptr2, len2, zero_level, col_offset, ptr3, len3, addHeapObject(output));
}

/**
 * Decode log-space quantized uint16 data to float32.
 * @param {Uint16Array} data
 * @param {number} max_log
 * @param {Float32Array} output
 */
export function decode_log_scalar_u16(data, max_log, output) {
    const ptr0 = passArray16ToWasm0(data, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = passArrayF32ToWasm0(output, wasm.__wbindgen_export);
    var len1 = WASM_VECTOR_LEN;
    wasm.decode_log_scalar_u16(ptr0, len0, max_log, ptr1, len1, addHeapObject(output));
}

/**
 * Decode log-space quantized uint8 data to float32.
 *
 * Used for positive scalars with wide dynamic range (e.g., radii).
 * Decoding: expm1(normalized * max_log)
 *
 * # Arguments
 * * `data` - Quantized uint8 values
 * * `max_log` - Maximum log value (from encoding)
 * * `output` - Output float32 buffer
 * @param {Uint8Array} data
 * @param {number} max_log
 * @param {Float32Array} output
 */
export function decode_log_scalar_u8(data, max_log, output) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = passArrayF32ToWasm0(output, wasm.__wbindgen_export);
    var len1 = WASM_VECTOR_LEN;
    wasm.decode_log_scalar_u8(ptr0, len0, max_log, ptr1, len1, addHeapObject(output));
}

/**
 * Decode LUT-encoded uint16 indices to float32 (row mode).
 * @param {Uint16Array} indices
 * @param {Float32Array} lut
 * @param {number} k
 * @param {Float32Array} output
 */
export function decode_lut_row_u16(indices, lut, k, output) {
    const ptr0 = passArray16ToWasm0(indices, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(lut, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    var ptr2 = passArrayF32ToWasm0(output, wasm.__wbindgen_export);
    var len2 = WASM_VECTOR_LEN;
    wasm.decode_lut_row_u16(ptr0, len0, ptr1, len1, k, ptr2, len2, addHeapObject(output));
}

/**
 * Decode LUT-encoded uint8 indices to float32 (row mode).
 *
 * Each index maps to k consecutive float values from the LUT.
 * Used for vector attributes like positions (xyz) or colors (rgb).
 *
 * # Arguments
 * * `indices` - uint8 indices into the LUT
 * * `lut` - Lookup table of float values [numEntries * k]
 * * `k` - Number of values per LUT entry
 * * `output` - Output float32 buffer [indices.len() * k]
 * @param {Uint8Array} indices
 * @param {Float32Array} lut
 * @param {number} k
 * @param {Float32Array} output
 */
export function decode_lut_row_u8(indices, lut, k, output) {
    const ptr0 = passArray8ToWasm0(indices, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(lut, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    var ptr2 = passArrayF32ToWasm0(output, wasm.__wbindgen_export);
    var len2 = WASM_VECTOR_LEN;
    wasm.decode_lut_row_u8(ptr0, len0, ptr1, len1, k, ptr2, len2, addHeapObject(output));
}

/**
 * Decode LUT-encoded uint16 indices to float32 (scalar mode).
 * @param {Uint16Array} indices
 * @param {Float32Array} lut
 * @param {Float32Array} output
 */
export function decode_lut_scalar_u16(indices, lut, output) {
    const ptr0 = passArray16ToWasm0(indices, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(lut, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    var ptr2 = passArrayF32ToWasm0(output, wasm.__wbindgen_export);
    var len2 = WASM_VECTOR_LEN;
    wasm.decode_lut_scalar_u16(ptr0, len0, ptr1, len1, ptr2, len2, addHeapObject(output));
}

/**
 * Decode LUT-encoded uint8 indices to float32 (scalar mode).
 *
 * Each index maps to a single float value from the LUT.
 *
 * # Arguments
 * * `indices` - uint8 indices into the LUT
 * * `lut` - Lookup table of float values
 * * `output` - Output float32 buffer (same length as indices)
 * @param {Uint8Array} indices
 * @param {Float32Array} lut
 * @param {Float32Array} output
 */
export function decode_lut_scalar_u8(indices, lut, output) {
    const ptr0 = passArray8ToWasm0(indices, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(lut, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    var ptr2 = passArrayF32ToWasm0(output, wasm.__wbindgen_export);
    var len2 = WASM_VECTOR_LEN;
    wasm.decode_lut_scalar_u8(ptr0, len0, ptr1, len1, ptr2, len2, addHeapObject(output));
}

/**
 * Decode quantized uint16 data to float32.
 *
 * Maps uint16 [0, 65535] to [min_val, max_val] linearly.
 *
 * # Arguments
 * * `data` - Quantized uint16 values
 * * `min_val` - Minimum output value
 * * `max_val` - Maximum output value
 * * `output` - Output float32 buffer (same length as data)
 * @param {Uint16Array} data
 * @param {number} min_val
 * @param {number} max_val
 * @param {Float32Array} output
 */
export function decode_quantized_u16(data, min_val, max_val, output) {
    const ptr0 = passArray16ToWasm0(data, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = passArrayF32ToWasm0(output, wasm.__wbindgen_export);
    var len1 = WASM_VECTOR_LEN;
    wasm.decode_quantized_u16(ptr0, len0, min_val, max_val, ptr1, len1, addHeapObject(output));
}

/**
 * Decode quantized uint8 data to float32.
 *
 * Maps uint8 [0, 255] to [min_val, max_val] linearly.
 *
 * # Arguments
 * * `data` - Quantized uint8 values
 * * `min_val` - Minimum output value
 * * `max_val` - Maximum output value
 * * `output` - Output float32 buffer (same length as data)
 * @param {Uint8Array} data
 * @param {number} min_val
 * @param {number} max_val
 * @param {Float32Array} output
 */
export function decode_quantized_u8(data, min_val, max_val, output) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = passArrayF32ToWasm0(output, wasm.__wbindgen_export);
    var len1 = WASM_VECTOR_LEN;
    wasm.decode_quantized_u8(ptr0, len0, min_val, max_val, ptr1, len1, addHeapObject(output));
}

/**
 * Decode per-channel SIGNED-LOG uint16 codes to float32.
 * @param {Uint16Array} data
 * @param {Float64Array} col_lo
 * @param {Float64Array} col_hi
 * @param {boolean} zero_level
 * @param {number} col_offset
 * @param {Float32Array} output
 */
export function decode_signed_log_perchannel_u16(data, col_lo, col_hi, zero_level, col_offset, output) {
    const ptr0 = passArray16ToWasm0(data, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(col_lo, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(col_hi, wasm.__wbindgen_export);
    const len2 = WASM_VECTOR_LEN;
    var ptr3 = passArrayF32ToWasm0(output, wasm.__wbindgen_export);
    var len3 = WASM_VECTOR_LEN;
    wasm.decode_signed_log_perchannel_u16(ptr0, len0, ptr1, len1, ptr2, len2, zero_level, col_offset, ptr3, len3, addHeapObject(output));
}

/**
 * Decode per-channel SIGNED-LOG uint8 codes to float32
 * (`y = ...; x = sign(y)·expm1(|y|)`).
 *
 * The Cholesky off-diagonal encoding (signed, zero-centred). `zero_level`
 * as in [`decode_log_perchannel_u8`].
 * @param {Uint8Array} data
 * @param {Float64Array} col_lo
 * @param {Float64Array} col_hi
 * @param {boolean} zero_level
 * @param {number} col_offset
 * @param {Float32Array} output
 */
export function decode_signed_log_perchannel_u8(data, col_lo, col_hi, zero_level, col_offset, output) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(col_lo, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(col_hi, wasm.__wbindgen_export);
    const len2 = WASM_VECTOR_LEN;
    var ptr3 = passArrayF32ToWasm0(output, wasm.__wbindgen_export);
    var len3 = WASM_VECTOR_LEN;
    wasm.decode_signed_log_perchannel_u8(ptr0, len0, ptr1, len1, ptr2, len2, zero_level, col_offset, ptr3, len3, addHeapObject(output));
}

/**
 * Extract 3D positions from nD positions using display dimension indices.
 *
 * # Arguments
 * * `positions_nd` - Input nD positions [numPoints * ndim]
 * * `display_dims` - Which dimensions to display as X,Y,Z [3 or fewer]
 * * `ndim` - Total number of dimensions
 * * `num_points` - Number of points
 * * `output` - Output 3D positions [numPoints * 3]
 *
 * # Example
 * For 5D data with display_dims=[0,2,4]:
 * - X = position[dim 0]
 * - Y = position[dim 2]
 * - Z = position[dim 4]
 * @param {Float32Array} positions_nd
 * @param {Uint32Array} display_dims
 * @param {number} ndim
 * @param {number} num_points
 * @param {Float32Array} output
 */
export function extract_3d_positions(positions_nd, display_dims, ndim, num_points, output) {
    const ptr0 = passArrayF32ToWasm0(positions_nd, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray32ToWasm0(display_dims, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    var ptr2 = passArrayF32ToWasm0(output, wasm.__wbindgen_export);
    var len2 = WASM_VECTOR_LEN;
    wasm.extract_3d_positions(ptr0, len0, ptr1, len1, ndim, num_points, ptr2, len2, addHeapObject(output));
}

/**
 * Interpolate clipped positions to 3D display space.
 *
 * For visible segments, computes clipped 3D positions using t1/t2 parameters.
 *
 * # Arguments
 * - `positions`: Vertex positions [numVertices * ndim]
 * - `segments`: Segment indices [numSegments * 2]
 * - `visibility`: Visibility mask [numSegments]
 * - `t1`: Start interpolation parameters [numSegments]
 * - `t2`: End interpolation parameters [numSegments]
 * - `display_dims`: Which dimensions to display [3]
 * - `ndim`: Number of dimensions
 * - `num_segments`: Total number of segments
 * - `output_start`: Output start positions [visibleCount * 3]
 * - `output_end`: Output end positions [visibleCount * 3]
 *
 * # Returns
 * Number of visible segments written
 * @param {Float32Array} positions
 * @param {Uint32Array} segments
 * @param {Uint8Array} visibility
 * @param {Float32Array} t1_params
 * @param {Float32Array} t2_params
 * @param {Uint32Array} display_dims
 * @param {number} ndim
 * @param {number} num_segments
 * @param {Float32Array} output_start
 * @param {Float32Array} output_end
 * @returns {number}
 */
export function interpolate_clipped_positions(positions, segments, visibility, t1_params, t2_params, display_dims, ndim, num_segments, output_start, output_end) {
    const ptr0 = passArrayF32ToWasm0(positions, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray32ToWasm0(segments, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(visibility, wasm.__wbindgen_export);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF32ToWasm0(t1_params, wasm.__wbindgen_export);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArrayF32ToWasm0(t2_params, wasm.__wbindgen_export);
    const len4 = WASM_VECTOR_LEN;
    const ptr5 = passArray32ToWasm0(display_dims, wasm.__wbindgen_export);
    const len5 = WASM_VECTOR_LEN;
    var ptr6 = passArrayF32ToWasm0(output_start, wasm.__wbindgen_export);
    var len6 = WASM_VECTOR_LEN;
    var ptr7 = passArrayF32ToWasm0(output_end, wasm.__wbindgen_export);
    var len7 = WASM_VECTOR_LEN;
    const ret = wasm.interpolate_clipped_positions(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, ndim, num_segments, ptr6, len6, addHeapObject(output_start), ptr7, len7, addHeapObject(output_end));
    return ret >>> 0;
}

/**
 * Batch interpolate RGB color attributes for visible segments.
 *
 * # Arguments
 * - `colors`: Per-vertex RGB colors [numVertices * 3]
 * - `segments`: Segment indices [numSegments * 2]
 * - `visibility`: Visibility mask [numSegments]
 * - `t1`: Start interpolation parameters [numSegments]
 * - `t2`: End interpolation parameters [numSegments]
 * - `num_segments`: Total number of segments
 * - `output_start`: Output interpolated start colors [visibleCount * 3]
 * - `output_end`: Output interpolated end colors [visibleCount * 3]
 *
 * # Returns
 * Number of visible segments written
 * @param {Float32Array} colors
 * @param {Uint32Array} segments
 * @param {Uint8Array} visibility
 * @param {Float32Array} t1_params
 * @param {Float32Array} t2_params
 * @param {number} num_segments
 * @param {Float32Array} output_start
 * @param {Float32Array} output_end
 * @returns {number}
 */
export function interpolate_colors_batch(colors, segments, visibility, t1_params, t2_params, num_segments, output_start, output_end) {
    const ptr0 = passArrayF32ToWasm0(colors, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray32ToWasm0(segments, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(visibility, wasm.__wbindgen_export);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF32ToWasm0(t1_params, wasm.__wbindgen_export);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArrayF32ToWasm0(t2_params, wasm.__wbindgen_export);
    const len4 = WASM_VECTOR_LEN;
    var ptr5 = passArrayF32ToWasm0(output_start, wasm.__wbindgen_export);
    var len5 = WASM_VECTOR_LEN;
    var ptr6 = passArrayF32ToWasm0(output_end, wasm.__wbindgen_export);
    var len6 = WASM_VECTOR_LEN;
    const ret = wasm.interpolate_colors_batch(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, num_segments, ptr5, len5, addHeapObject(output_start), ptr6, len6, addHeapObject(output_end));
    return ret >>> 0;
}

/**
 * Batch interpolate scalar attributes for visible segments.
 *
 * Interpolates values using t1/t2 parameters and compacts to visible-only output.
 *
 * # Arguments
 * - `values`: Per-vertex attribute values [numVertices]
 * - `segments`: Segment indices [numSegments * 2]
 * - `visibility`: Visibility mask [numSegments]
 * - `t1`: Start interpolation parameters [numSegments]
 * - `t2`: End interpolation parameters [numSegments]
 * - `num_segments`: Total number of segments
 * - `output_start`: Output interpolated start values [visibleCount]
 * - `output_end`: Output interpolated end values [visibleCount]
 *
 * # Returns
 * Number of visible segments written
 * @param {Float32Array} values
 * @param {Uint32Array} segments
 * @param {Uint8Array} visibility
 * @param {Float32Array} t1_params
 * @param {Float32Array} t2_params
 * @param {number} num_segments
 * @param {Float32Array} output_start
 * @param {Float32Array} output_end
 * @returns {number}
 */
export function interpolate_scalars_batch(values, segments, visibility, t1_params, t2_params, num_segments, output_start, output_end) {
    const ptr0 = passArrayF32ToWasm0(values, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray32ToWasm0(segments, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(visibility, wasm.__wbindgen_export);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF32ToWasm0(t1_params, wasm.__wbindgen_export);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArrayF32ToWasm0(t2_params, wasm.__wbindgen_export);
    const len4 = WASM_VECTOR_LEN;
    var ptr5 = passArrayF32ToWasm0(output_start, wasm.__wbindgen_export);
    var len5 = WASM_VECTOR_LEN;
    var ptr6 = passArrayF32ToWasm0(output_end, wasm.__wbindgen_export);
    var len6 = WASM_VECTOR_LEN;
    const ret = wasm.interpolate_scalars_batch(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, num_segments, ptr5, len5, addHeapObject(output_start), ptr6, len6, addHeapObject(output_end));
    return ret >>> 0;
}

/**
 * Compute Mahalanobis distance for a single point using packed Cholesky factor.
 *
 * Given L (lower-triangular Cholesky of covariance),
 * Mahalanobis distance = ||L⁻¹ · (x - μ)||
 *
 * We use forward substitution to solve L·y = d, then ||y|| is the Mahalanobis distance.
 *
 * # Arguments
 * * `diff` - Difference vector (x - μ) for the dimensions [ndim]
 * * `packed_l` - Packed Cholesky factor [packedSize]
 * * `ndim` - Dimensionality of the Cholesky (max 16)
 *
 * # Returns
 * Mahalanobis distance
 *
 * # Panics
 * Panics if `ndim > 16`. Use TypeScript fallback for higher dimensions.
 *
 * # Optimization Notes
 * - Direct division (bit-consistent with the TS reference)
 * - Hoisted epsilon constant
 * - Loop fusion for norm computation
 * @param {Float32Array} diff
 * @param {Float32Array} packed_l
 * @param {number} ndim
 * @returns {number}
 */
export function mahalanobis_distance(diff, packed_l, ndim) {
    const ptr0 = passArrayF32ToWasm0(diff, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(packed_l, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.mahalanobis_distance(ptr0, len0, ptr1, len1, ndim);
    return ret;
}

/**
 * Compute per-vertex nD slab membership.
 *
 * For each non-displayed ("hidden") dimension `d`, with
 * `slice_min = slice_position[d] - tolerance[d]` and
 * `slice_max = slice_position[d] + tolerance[d]`, a vertex is **in** iff
 * `v[d] >= slice_min && v[d] <= slice_max` for *every* such `d`. Displayed
 * dimensions are skipped entirely (they are what gets rendered).
 *
 * This is precisely the `p1_in` branch of
 * [`crate::lines_clipping::clip_segment_single`], applied per vertex.
 *
 * # Non-finite coordinates
 *
 * A `NaN` or `±Inf` coordinate on any hidden dimension makes the vertex
 * **invisible** — the #806 rule, enforced identically in both lines backends
 * and now both mesh backends.
 *
 * The explicit `is_finite` test is load-bearing, not decorative. `NaN` fails
 * both comparisons and `±Inf` fails against any finite bound, so the bare
 * range test looks sufficient — but a caller passing a genuinely infinite
 * `tolerance` (rather than the finite `EXTEND_TO_ALL_TOLERANCE` sentinel,
 * `1e10`) makes `slice_max = +Inf`, and `+Inf <= +Inf` is **true**. Without
 * this test an infinite coordinate would then be reported visible.
 *
 * The rule covers the *coordinate* only, and the slab parameters behave the
 * OPPOSITE way — worth knowing before reading a surprising screen:
 *
 * - a `NaN` in `slice_position` or `tolerance` makes every **finite** vertex
 *   visible, because `value < NaN` and `value > NaN` are both false, so the
 *   slab test degenerates to "not non-finite". It fails OPEN, not closed.
 * - a **negative** `tolerance` inverts the slab (`min > max`) and culls
 *   everything.
 *
 * Both are caller bugs — `slice_position` and `tolerance` are viewer-computed,
 * not store-supplied — and both backends agree exactly (verified across the
 * full non-finite matrix), so neither is guarded here. Callers deriving a
 * tolerance from possibly-absent dimension metadata should not let a `NaN`
 * reach this kernel expecting it to be culled.
 *
 * # Arguments
 * * `positions` - Vertex positions [num_vertices * ndim]
 * * `slice_position` - Current slice position [ndim]
 * * `tolerance` - Per-dimension tolerance [ndim]
 * * `display_dims` - Which dimensions are displayed [num_display_dims]
 * * `ndim` - Number of dimensions
 * * `num_vertices` - Number of vertices
 * * `output` - Output visibility mask [num_vertices] (1 = in, 0 = out)
 *
 * # Returns
 * Number of visible vertices.
 *
 * # Panics
 * Via `validate_ndim` when `ndim > 16`. Callers must route above that to the
 * TypeScript backend (`pickBackend` does this transparently).
 * @param {Float32Array} positions
 * @param {Float32Array} slice_position
 * @param {Float32Array} tolerance
 * @param {Uint32Array} display_dims
 * @param {number} ndim
 * @param {number} num_vertices
 * @param {Uint8Array} output
 * @returns {number}
 */
export function mesh_vertex_visibility_mask(positions, slice_position, tolerance, display_dims, ndim, num_vertices, output) {
    const ptr0 = passArrayF32ToWasm0(positions, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(slice_position, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF32ToWasm0(tolerance, wasm.__wbindgen_export);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArray32ToWasm0(display_dims, wasm.__wbindgen_export);
    const len3 = WASM_VECTOR_LEN;
    var ptr4 = passArray8ToWasm0(output, wasm.__wbindgen_export);
    var len4 = WASM_VECTOR_LEN;
    const ret = wasm.mesh_vertex_visibility_mask(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ndim, num_vertices, ptr4, len4, addHeapObject(output));
    return ret >>> 0;
}

/**
 * @param {Float32Array} positions
 * @param {Uint32Array} display_dims
 * @param {Float32Array} slice_position
 * @param {Float32Array} tolerance
 * @param {Uint8Array} discrete_dims
 * @param {number} ndim
 * @param {number} num_points
 * @param {Uint8Array} output
 * @returns {number}
 */
export function points_slice_membership(positions, display_dims, slice_position, tolerance, discrete_dims, ndim, num_points, output) {
    const ptr0 = passArrayF32ToWasm0(positions, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray32ToWasm0(display_dims, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF32ToWasm0(slice_position, wasm.__wbindgen_export);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF32ToWasm0(tolerance, wasm.__wbindgen_export);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArray8ToWasm0(discrete_dims, wasm.__wbindgen_export);
    const len4 = WASM_VECTOR_LEN;
    var ptr5 = passArray8ToWasm0(output, wasm.__wbindgen_export);
    var len5 = WASM_VECTOR_LEN;
    const ret = wasm.points_slice_membership(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ndim, num_points, ptr5, len5, addHeapObject(output));
    return ret >>> 0;
}

/**
 * Fused nD→3D GSplat projection in a SINGLE pass over the splats.
 *
 * Collapses the previous 6-call worker pipeline
 * (`compute_gsplats_attenuation` + `extract_3d_positions` + `compact_by_mask`
 * for centers + `extract_visible_cholesky_3d` + `compact_attenuated_amplitudes`
 * + `compact_by_mask` for colors) into one kernel, eliminating ~5 full passes
 * over `splat_count` and the repeated copies of the large `positions` /
 * `cholesky` arrays across the wasm-bindgen boundary.
 *
 * For each splat it: (1) applies the precomputed discrete-visibility gate,
 * (2) computes continuous attenuation (marginal Cholesky + shifted Gaussian),
 * (3) decides visibility via `amplitude * attenuation >= min_amplitude`, and
 * (4) writes COMPACTED outputs (visible centers3D, cholesky3D[6], attenuated
 * amplitudes, colors) densely from index 0. The compaction stride and
 * visibility gating are exercised by `test_fused_compaction_stride`.
 *
 * Colors are coerced to normalized f32 on the TS side (wasm-bindgen can't take
 * a typed-array union), so `colors` is `[splat_count * color_components]` f32
 * (white-filled when the dataset has no colors). `color_components` is 3 (RGB)
 * or 4 (RGBA — alpha is per-splat opacity and compacts with its splat).
 *
 * Outputs must be sized for the `splat_count` worst case; the caller slices
 * each to the returned visible count.
 *
 * # Arguments
 * * `positions` - Splat centers [splat_count * ndim]
 * * `cholesky` - Packed Cholesky factors [splat_count * packedSize]
 * * `amplitudes` - Splat amplitudes [splat_count]
 * * `colors` - Pre-normalized RGB(A) [splat_count * color_components]
 * * `color_components` - 3 (RGB) or 4 (RGBA)
 * * `discrete_visibility` - Precomputed discrete-dim gate [splat_count] (all 1 if none)
 * * `slice_position` - Current slice [ndim]
 * * `continuous_hidden_dims` - Sorted continuous hidden dims [num_continuous]
 * * `display_dims` - Display dims in requested order [1 to 3]
 * * `ndim`, `splat_count`, `min_amplitude`, `truncate`
 * * `out_centers3d` [splat_count * 3], `out_cholesky3d` [splat_count * 6],
 *   `out_amplitudes` [splat_count], `out_colors` [splat_count * color_components]
 * * `out_source_indices` - Per emitted splat, the SOURCE index `i` it came
 *   from [splat_count]. Compaction destroys that mapping, and picking needs it
 *   to translate a storage slot back into an on-disk element index (issue
 *   #1423). Pass an EMPTY slice to opt out — the recording is then skipped
 *   entirely and costs nothing.
 *
 * # Returns
 * Number of visible splats written (dense prefix length / stride).
 *
 * # Panics
 * Panics if `ndim > 16`. The worker routes >16D to the uncapped TS reference.
 * @param {Float32Array} positions
 * @param {Float32Array} cholesky
 * @param {Float32Array} amplitudes
 * @param {Float32Array} colors
 * @param {Uint8Array} discrete_visibility
 * @param {Float32Array} slice_position
 * @param {Uint32Array} continuous_hidden_dims
 * @param {Uint32Array} display_dims
 * @param {number} ndim
 * @param {number} splat_count
 * @param {number} color_components
 * @param {number} min_amplitude
 * @param {number} truncate
 * @param {Float32Array} out_centers3d
 * @param {Float32Array} out_cholesky3d
 * @param {Float32Array} out_amplitudes
 * @param {Float32Array} out_colors
 * @param {Uint32Array} out_source_indices
 * @returns {number}
 */
export function project_gsplats_nd_to_3d(positions, cholesky, amplitudes, colors, discrete_visibility, slice_position, continuous_hidden_dims, display_dims, ndim, splat_count, color_components, min_amplitude, truncate, out_centers3d, out_cholesky3d, out_amplitudes, out_colors, out_source_indices) {
    const ptr0 = passArrayF32ToWasm0(positions, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(cholesky, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF32ToWasm0(amplitudes, wasm.__wbindgen_export);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF32ToWasm0(colors, wasm.__wbindgen_export);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArray8ToWasm0(discrete_visibility, wasm.__wbindgen_export);
    const len4 = WASM_VECTOR_LEN;
    const ptr5 = passArrayF32ToWasm0(slice_position, wasm.__wbindgen_export);
    const len5 = WASM_VECTOR_LEN;
    const ptr6 = passArray32ToWasm0(continuous_hidden_dims, wasm.__wbindgen_export);
    const len6 = WASM_VECTOR_LEN;
    const ptr7 = passArray32ToWasm0(display_dims, wasm.__wbindgen_export);
    const len7 = WASM_VECTOR_LEN;
    var ptr8 = passArrayF32ToWasm0(out_centers3d, wasm.__wbindgen_export);
    var len8 = WASM_VECTOR_LEN;
    var ptr9 = passArrayF32ToWasm0(out_cholesky3d, wasm.__wbindgen_export);
    var len9 = WASM_VECTOR_LEN;
    var ptr10 = passArrayF32ToWasm0(out_amplitudes, wasm.__wbindgen_export);
    var len10 = WASM_VECTOR_LEN;
    var ptr11 = passArrayF32ToWasm0(out_colors, wasm.__wbindgen_export);
    var len11 = WASM_VECTOR_LEN;
    var ptr12 = passArray32ToWasm0(out_source_indices, wasm.__wbindgen_export);
    var len12 = WASM_VECTOR_LEN;
    const ret = wasm.project_gsplats_nd_to_3d(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, ptr6, len6, ptr7, len7, ndim, splat_count, color_components, min_amplitude, truncate, ptr8, len8, addHeapObject(out_centers3d), ptr9, len9, addHeapObject(out_cholesky3d), ptr10, len10, addHeapObject(out_amplitudes), ptr11, len11, addHeapObject(out_colors), ptr12, len12, addHeapObject(out_source_indices));
    return ret >>> 0;
}

/**
 * Sort splats back-to-front by camera-space depth.
 *
 * # Arguments
 * - `centers3`: Projected 3D splat centers `[count * 3]` (x, y, z triplets)
 * - `model_view`: Column-major 4x4 model-view matrix `[16]`
 *   (`camera.matrixWorldInverse × mesh.matrixWorld`, THREE.js layout)
 * - `ordering`: Output permutation `[count]` — `ordering[j]` is the original
 *   splat index drawn at instance slot `j` (slot 0 = farthest)
 * - `count`: Number of splats
 *
 * # Returns
 * Number of splats placed via depth keys, or `0` when the identity
 * fallback was taken (degenerate depth range — the ordering is still
 * fully written).
 * @param {Float32Array} centers3
 * @param {Float32Array} model_view
 * @param {Uint32Array} ordering
 * @param {number} count
 * @returns {number}
 */
export function sort_splats_by_depth(centers3, model_view, ordering, count) {
    const ptr0 = passArrayF32ToWasm0(centers3, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(model_view, wasm.__wbindgen_export);
    const len1 = WASM_VECTOR_LEN;
    var ptr2 = passArray32ToWasm0(ordering, wasm.__wbindgen_export);
    var len2 = WASM_VECTOR_LEN;
    const ret = wasm.sort_splats_by_depth(ptr0, len0, ptr1, len1, ptr2, len2, addHeapObject(ordering), count);
    return ret >>> 0;
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_copy_to_typed_array_88899a52af046901: function(arg0, arg1, arg2) {
            new Uint8Array(getObject(arg2).buffer, getObject(arg2).byteOffset, getObject(arg2).byteLength).set(getArrayU8FromWasm0(arg0, arg1));
        },
        __wbindgen_object_drop_ref: function(arg0) {
            takeObject(arg0);
        },
    };
    return {
        __proto__: null,
        "./luxar_wasm_bg.js": import0,
    };
}

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

function dropObject(idx) {
    if (idx < 1028) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

let cachedUint16ArrayMemory0 = null;
function getUint16ArrayMemory0() {
    if (cachedUint16ArrayMemory0 === null || cachedUint16ArrayMemory0.byteLength === 0) {
        cachedUint16ArrayMemory0 = new Uint16Array(wasm.memory.buffer);
    }
    return cachedUint16ArrayMemory0;
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getObject(idx) { return heap[idx]; }

let heap = new Array(1024).fill(undefined);
heap.push(undefined, null, true, false);

let heap_next = heap.length;

function passArray16ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 2, 2) >>> 0;
    getUint16ArrayMemory0().set(arg, ptr / 2);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedFloat32ArrayMemory0 = null;
    cachedFloat64ArrayMemory0 = null;
    cachedUint16ArrayMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('luxar_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
