/**
 * This defines the shaders and uniforms the geometry of the track, adding an
 * options to highlight a portion of the line with a fatter line + LUT. You can
 * also hide the rest of the track.
 *
 * Compared to Line2, this removes support for dashed lines and non-world units.
 *
 * see:
 *  https://github.com/mrdoob/three.js/blob/5ed5417d63e4eeba5087437cc27ab1e3d0813aea/examples/jsm/lines/LineMaterial.js
 */

import config from "../../../CONFIG.ts";
const colormapTracks = config.settings.colormap_tracks || "viridis-inferno";

import {
    DataTexture,
    RGBAFormat,
    SRGBColorSpace,
    ShaderLib,
    ShaderMaterial,
    ShaderMaterialParameters,
    UniformsLib,
    UniformsUtils,
    UnsignedByteType,
    Vector2,
} from "three";
import { Lut } from "three/examples/jsm/Addons.js";

export const highlightLUT = new Lut();
// generated using https://waldyrious.net/viridis-palette-generator/
highlightLUT.addColorMap("magma-inferno", [
    // magma_inverse + inferno
    [0.0, 0x000004],
    [0.05, 0x140e36],
    [0.1, 0x3b0f70],
    [0.15, 0x641a80],
    [0.2, 0x8c2981],
    [0.25, 0xb73779],
    [0.3, 0xde4968],
    [0.35, 0xf7705c],
    [0.4, 0xfe9f6d],
    [0.45, 0xfecf92],
    [0.5, 0xfcffa4], // bright center
    [0.55, 0xf6d746],
    [0.6, 0xfca50a],
    [0.65, 0xf37819],
    [0.7, 0xdd513a],
    [0.75, 0xbc3754],
    [0.8, 0x932667],
    [0.85, 0x6a176e],
    [0.9, 0x420a68],
    [0.95, 0x160b39],
    [1.0, 0x000004],
]);
highlightLUT.addColorMap("viridis-inferno", [
    // viridis_inverse + inferno
    [0.0, 0x440154],
    [0.05, 0x482475],
    [0.1, 0x414487],
    [0.15, 0x355f8d],
    [0.2, 0x2a788e],
    [0.25, 0x21918c],
    [0.3, 0x22a884],
    [0.35, 0x44bf70],
    [0.4, 0x7ad151],
    [0.45, 0xbddf26],
    [0.5, 0xfcffa4], // bright center
    [0.55, 0xf6d746],
    [0.6, 0xfca50a],
    [0.65, 0xf37819],
    [0.7, 0xdd513a],
    [0.75, 0xbc3754],
    [0.8, 0x932667],
    [0.85, 0x6a176e],
    [0.9, 0x420a68],
    [0.95, 0x160b39],
    [1.0, 0x000004],
]);
highlightLUT.addColorMap("inferno-inferno", [
    // inferno_inverse + inferno
    [0.0, 0x000004],
    [0.05, 0x160b39],
    [0.1, 0x420a68],
    [0.15, 0x6a176e],
    [0.2, 0x932667],
    [0.25, 0xbc3754],
    [0.3, 0xdd513a],
    [0.35, 0xf37819],
    [0.4, 0xfca50a],
    [0.45, 0xf6d746],
    [0.5, 0xfcffa4], // bright center
    [0.55, 0xf6d746],
    [0.6, 0xfca50a],
    [0.65, 0xf37819],
    [0.7, 0xdd513a],
    [0.75, 0xbc3754],
    [0.8, 0x932667],
    [0.85, 0x6a176e],
    [0.9, 0x420a68],
    [0.95, 0x160b39],
    [1.0, 0x000004],
]);

highlightLUT.setColorMap(colormapTracks);
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

const trackUniforms = {
    trackwidth: { value: 0.5 }, // this is just linewidth renamed
    // controls whether to show the full track (not the highlight)
    showtrack: { value: true },
    // the following uniforms are added to control the highlight
    highlightwidth: { value: 1.5 },
    highlightLUT: { value: highlightLUTTexture },
    showhighlight: { value: true },
    minTime: { value: 0 },
    maxTime: { value: -1 },
    // this was kept from the original LineMaterial code
    resolution: { value: new Vector2(1, 1) },
};

ShaderLib["track"] = {
    uniforms: UniformsUtils.merge([UniformsLib.common, UniformsLib.fog, trackUniforms]),

    vertexShader: /* glsl */ `
        #include <common>
        #include <color_pars_vertex>
        #include <fog_pars_vertex>
        #include <logdepthbuf_pars_vertex>
        #include <clipping_planes_pars_vertex>

        // TRACK SPECIFIC UNIFORMS
        uniform float trackwidth;
        uniform float highlightwidth;
        uniform bool showhighlight;
        uniform float minTime;
        uniform float maxTime;

        uniform vec2 resolution;

        attribute vec3 instanceStart;
        attribute vec3 instanceEnd;

        attribute vec3 instanceColorStart;
        attribute vec3 instanceColorEnd;

        // TRACK SPECIFIC ATTRIBUTES
        // SEE TrackGeometry
        attribute float instanceTimeStart;
        attribute float instanceTimeEnd;

        // TRACK SPECIFIC VARYINGS
        varying float vTime;

        varying vec4 worldPos;
        varying vec3 worldStart;
        varying vec3 worldEnd;

        void trimSegment( const in vec4 start, inout vec4 end ) {

            // trim end segment so it terminates between the camera plane and the near plane

            // conservative estimate of the near plane
            float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
            float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
            float nearEstimate = - 0.5 * b / a;

            float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

            end.xyz = mix( start.xyz, end.xyz, alpha );

        }

        void main() {

            // TRACK SPECIFIC CODE ADDED
            // INTERPOLATE TIME BETWEEN START AND END INSTANCES
            vTime = ( position.y < 0.5 ) ? instanceTimeStart : instanceTimeEnd;

            #ifdef USE_COLOR

                vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

            #endif

            float aspect = resolution.x / resolution.y;

            // camera space
            vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
            vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

            worldStart = start.xyz;
            worldEnd = end.xyz;

            // special case for perspective projection, and segments that terminate either in, or behind, the camera plane
            // clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
            // but we need to perform ndc-space calculations in the shader, so we must address this issue directly
            // perhaps there is a more elegant solution -- WestLangley

            bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

            if ( perspective ) {

                if ( start.z < 0.0 && end.z >= 0.0 ) {

                    trimSegment( start, end );

                } else if ( end.z < 0.0 && start.z >= 0.0 ) {

                    trimSegment( end, start );

                }

            }

            // clip space
            vec4 clipStart = projectionMatrix * start;
            vec4 clipEnd = projectionMatrix * end;

            // ndc space
            vec3 ndcStart = clipStart.xyz / clipStart.w;
            vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

            // direction
            vec2 dir = ndcEnd.xy - ndcStart.xy;

            // account for clip-space aspect ratio
            dir.x *= aspect;
            dir = normalize( dir );

            // TRACK SPECIFIC CODE ADDED
            // UPDATE THE WIDTH IF IN THE HIGHLIGHT
            float w = trackwidth;
            if (showhighlight && vTime > minTime && vTime < maxTime) {
                w = highlightwidth;
            }

            vec3 worldDir = normalize( end.xyz - start.xyz );
            vec3 tmpFwd = normalize( mix( start.xyz, end.xyz, 0.5 ) );
            vec3 worldUp = normalize( cross( worldDir, tmpFwd ) );
            vec3 worldFwd = cross( worldDir, worldUp );
            worldPos = position.y < 0.5 ? start: end;

            // height offset
            float hw = w * 0.5;
            worldPos.xyz += position.x < 0.0 ? hw * worldUp : - hw * worldUp;

            // cap extension
            worldPos.xyz += position.y < 0.5 ? - hw * worldDir : hw * worldDir;

            // add width to the box
            worldPos.xyz += worldFwd * hw;

            // endcaps
            if ( position.y > 1.0 || position.y < 0.0 ) {

                worldPos.xyz -= worldFwd * 2.0 * hw;

            }

            // project the worldpos
            vec4 clip = projectionMatrix * worldPos;

            // shift the depth of the projected points so the line
            // segments overlap neatly
            vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
            clip.z = clipPose.z * clip.w;

            gl_Position = clip;

            vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

            #include <logdepthbuf_vertex>
            #include <clipping_planes_vertex>
            #include <fog_vertex>

        }
        `,

    fragmentShader: /* glsl */ `
        uniform vec3 diffuse;
        uniform float opacity;

        // TRACK SPECIFIC UNIFORMS
        uniform float trackwidth; // this is just linewidth renamed
        uniform bool showtrack;
        uniform float highlightwidth;
        uniform bool showhighlight;
        uniform sampler2D highlightLUT;
        uniform float minTime;
        uniform float maxTime;

        // TRACK SPECIFIC VARYINGS
        varying float vTime;

        varying vec4 worldPos;
        varying vec3 worldStart;
        varying vec3 worldEnd;

        #include <common>
        #include <color_pars_fragment>
        #include <fog_pars_fragment>
        #include <logdepthbuf_pars_fragment>
        #include <clipping_planes_pars_fragment>

        vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

            float mua;
            float mub;

            vec3 p13 = p1 - p3;
            vec3 p43 = p4 - p3;

            vec3 p21 = p2 - p1;

            float d1343 = dot( p13, p43 );
            float d4321 = dot( p43, p21 );
            float d1321 = dot( p13, p21 );
            float d4343 = dot( p43, p43 );
            float d2121 = dot( p21, p21 );

            float denom = d2121 * d4343 - d4321 * d4321;

            float numer = d1343 * d4321 - d1321 * d4343;

            mua = numer / denom;
            mua = clamp( mua, 0.0, 1.0 );
            mub = ( d1343 + d4321 * ( mua ) ) / d4343;
            mub = clamp( mub, 0.0, 1.0 );

            return vec2( mua, mub );

        }

        void main() {

            #include <clipping_planes_fragment>

            float alpha = opacity;

            // TRACK SPECIFIC CODE ADDED
            // UPDATE THE WIDTH IF IN THE HIGHLIGHT
            float w = trackwidth;
            if (showhighlight && vTime > minTime && vTime < maxTime) {
                w = highlightwidth;
            }

            // Find the closest points on the view ray and the line segment
            vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
            vec3 lineDir = worldEnd - worldStart;
            vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

            vec3 p1 = worldStart + lineDir * params.x;
            vec3 p2 = rayEnd * params.y;
            vec3 delta = p1 - p2;
            float len = length( delta );
            float norm = len / w;

            #ifdef USE_ALPHA_TO_COVERAGE

                float dnorm = fwidth( norm );
                alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

            #else

                if ( norm > 0.5 ) {

                    discard;

                }

            #endif

            vec4 diffuseColor = vec4( diffuse, alpha );

            #include <logdepthbuf_fragment>
            #include <color_fragment>

            gl_FragColor = vec4( diffuseColor.rgb, alpha );

            // TRACK SPECIFIC CODE ADDED
            // SET THE HIGHLIGHT COLOR, SAMPLED FROM THE LUT
            if (showhighlight && vTime > minTime && vTime < maxTime) {
                float t = (vTime - minTime) / (maxTime - minTime);
                gl_FragColor.rgb = texture2D( highlightLUT, vec2(t, 0.0) ).rgb;
                gl_FragColor.a = 0.9;
            } else if (!showtrack) {
                discard;
            }

            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            #include <fog_fragment>
            #include <premultiplied_alpha_fragment>

        }
        `,
};

// here we add the new uniforms for use in the constructor
interface TrackMaterialParameters extends ShaderMaterialParameters {
    color?: number;
    trackwidth?: number;
    showtrack?: boolean;
    showhighlight?: boolean;
    highlightwidth?: number;
    highlightLUT?: DataTexture;
    minTime?: number;
    maxTime?: number;
    resolution?: Vector2;
}

class TrackMaterial extends ShaderMaterial {
    isTrackMaterial: boolean = true;
    type: string = "TrackMaterial";

    constructor(parameters: TrackMaterialParameters) {
        super({
            uniforms: UniformsUtils.clone(ShaderLib["track"].uniforms),

            vertexShader: ShaderLib["track"].vertexShader,
            fragmentShader: ShaderLib["track"].fragmentShader,

            clipping: true, // required for clipping support
        });

        this.setValues(parameters);

        // this is needed because opacity and alphaToCoverage cannot be
        // overridden in typescript (2611) to have side-effects
        this.setOpacity(this.opacity);
        this.setAlphaToCoverage(this.alphaToCoverage);
    }

    // getters/setters make sure the uniforms are updated when the properties are set

    get color() {
        return this.uniforms.diffuse.value;
    }

    set color(value) {
        this.uniforms.diffuse.value = value;
    }

    get trackwidth() {
        return this.uniforms.trackwidth.value;
    }

    set trackwidth(value) {
        if (!this.uniforms.trackwidth) return;
        this.uniforms.trackwidth.value = value;
    }

    get highlightwidth() {
        return this.uniforms.highlightwidth.value;
    }

    set highlightwidth(value) {
        if (!this.uniforms.highlightwidth) return;
        this.uniforms.highlightwidth.value = value;
    }

    get minTime() {
        return this.uniforms.minTime.value;
    }

    set minTime(value) {
        if (!this.uniforms.minTime) return;
        this.uniforms.minTime.value = value;
    }

    get maxTime() {
        return this.uniforms.maxTime.value;
    }

    set maxTime(value) {
        if (!this.uniforms.maxTime) return;
        this.uniforms.maxTime.value = value;
    }

    get highlightLUT() {
        return this.uniforms.highlightLUT.value;
    }

    set highlightLUT(value) {
        if (!this.uniforms.highlightLUT) return;
        this.uniforms.highlightLUT.value = value;
        this.needsUpdate = true;
    }

    get showtrack() {
        return this.uniforms.showtrack.value;
    }

    set showtrack(value) {
        if (!this.uniforms.showtrack) return;
        this.uniforms.showtrack.value = value;
    }

    get showhighlight() {
        return this.uniforms.showhighlight.value;
    }

    set showhighlight(value) {
        if (!this.uniforms.showhighlight) return;
        this.uniforms.showhighlight.value = value;
    }

    get resolution() {
        return this.uniforms.resolution.value;
    }

    set resolution(value) {
        this.uniforms.resolution.value.copy(value);
    }

    setOpacity(value: number) {
        this.opacity = value;
        if (!this.uniforms) return;
        this.uniforms.opacity.value = value;
    }

    setAlphaToCoverage(value: boolean) {
        this.alphaToCoverage = value;

        if (!this.defines) return;

        if ((value === true) !== this.alphaToCoverage) {
            this.needsUpdate = true;
        }

        if (value === true) {
            this.defines.USE_ALPHA_TO_COVERAGE = "";
            this.extensions.derivatives = true;
        } else {
            delete this.defines.USE_ALPHA_TO_COVERAGE;
            this.extensions.derivatives = false;
        }
    }
}

export { TrackMaterial };
