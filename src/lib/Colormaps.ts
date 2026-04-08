import { Color } from "three";
import { Lut } from "three/examples/jsm/Addons.js";

// generated using https://waldyrious.net/viridis-palette-generator/
// and: https://hauselin.github.io/colorpalettejs/

class ExtendedLut extends Lut {
    private colormapNames: Set<string> = new Set();

    // Override addColorMap to track colormap names
    addColorMap(name: string, colors: [number, number][]): this {
        super.addColorMap(name, colors);
        this.colormapNames.add(name);
        return this; // Ensure it returns 'this' for method chaining
    }

    // Override setColorMap with fallback behavior
    setColorMap(colormap?: string, numberofcolors?: number): this {
        if (colormap && !this.colormapNames.has(colormap)) {
            console.error(`Invalid colormap name: '${colormap}'. Reverting to the default colormap: 'viridis'.`);
            colormap = "viridis"; // Set to the default colormap
        }

        return super.setColorMap(colormap, numberofcolors); // Call the parent method with the (possibly corrected) name
    }

    // Method to retrieve all available colormap names
    getColormapNames(): string[] {
        return Array.from(this.colormapNames);
    }
}

export const colormaps = new ExtendedLut();

export const TRACK_COLORMAP_NAMES = [
    "viridis-inferno",
    "inferno-inferno",
    "cividis-inferno",
    "coolwarm",
    "RedBlue",
    "RedYelBlue",
    "Spectral",
    "YellowRed",
    "GreenBlue",
    "PurpleGold",
    "CyanRed",
    "BlueRed",
];
export const CELL_COLORMAP_NAMES = [
    "HSL",
    "viridis",
    "plasma",
    "inferno",
    "magma",
    "cividis",
    "YellowRed",
    "GreenBlue",
    "PurpleGold",
    "CyanRed",
    "BlueRed",
];

colormaps.addColorMap("viridis", [
    [0.0, 0x440154], // purple
    [0.1, 0x482475],
    [0.2, 0x414487],
    [0.3, 0x355f8d],
    [0.4, 0x2a788e],
    [0.5, 0x21918c],
    [0.6, 0x22a884],
    [0.7, 0x44bf70],
    [0.8, 0x7ad151],
    [0.9, 0xbddf26],
    [1.0, 0xfcffa4], // yellow
]);

// colormaps.addColorMap("viridis-clipped", [
//     // viridis with clipped extreme purple/yellow ends
//     [0.0, 0x482475],
//     [0.125, 0x414487], // purple
//     [0.25, 0x355f8d],
//     [0.375, 0x2a788e],
//     [0.5, 0x21918c],
//     [0.625, 0x22a884],
//     [0.75, 0x44bf70],
//     [0.875, 0x7ad151], // yellow
//     [1.0, 0xbddf26],
// ]);

colormaps.addColorMap("magma", [
    [0.0, 0x000004],
    [0.1, 0x140e36],
    [0.2, 0x3b0f70],
    [0.3, 0x641a80],
    [0.4, 0x8c2981],
    [0.5, 0xb73779],
    [0.6, 0xde4968],
    [0.7, 0xf7705c],
    [0.8, 0xfe9f6d],
    [0.9, 0xfecf92],
    [1.0, 0xfcffa4],
]);

colormaps.addColorMap("inferno", [
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

colormaps.addColorMap("plasma", [
    [0.0, 0x0d0887],
    [0.1, 0x41049d],
    [0.2, 0x6a00a8],
    [0.3, 0x8f0da4],
    [0.4, 0xb12a90],
    [0.5, 0xcc4778],
    [0.6, 0xe16462],
    [0.7, 0xf2844b],
    [0.8, 0xfca636],
    [0.9, 0xfcce25],
    [1.0, 0xfcffa4],
]);

colormaps.addColorMap("cividis", [
    [0.0, 0x002051],
    [0.1, 0x0d346b],
    [0.2, 0x33486e],
    [0.3, 0x575c6e],
    [0.4, 0x737172],
    [0.5, 0x8b8677],
    [0.6, 0xa49d78],
    [0.7, 0xc3b56d],
    [0.8, 0xe6cf59],
    [0.9, 0xfdea45],
    [1.0, 0xfcffa4],
]);

colormaps.addColorMap("viridis-inferno", [
    // viridis_inv + inferno
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
colormaps.addColorMap("inferno-inferno", [
    // inferno_inv + inferno
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
colormaps.addColorMap("cividis-inferno", [
    // cividis_inv + inferno
    [0.0, 0x002051],
    [0.05, 0x0d346b],
    [0.1, 0x33486e],
    [0.15, 0x575c6e],
    [0.2, 0x737172],
    [0.25, 0x8b8677],
    [0.3, 0xa49d78],
    [0.35, 0xc3b56d],
    [0.4, 0xe6cf59],
    [0.45, 0xfdea45],
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

colormaps.addColorMap("coolwarm", [
    // blue → white → red (matplotlib coolwarm)
    [0.0, 0x3b4cc0], // dark blue
    [0.1, 0x5d7ce8],
    [0.2, 0x82a6fb],
    [0.3, 0xaec0f0],
    [0.4, 0xd3d8ec],
    [0.5, 0xf2f2f2], // neutral white
    [0.6, 0xf1c9a0],
    [0.7, 0xe99a6e],
    [0.8, 0xd65240],
    [0.9, 0xc21c26],
    [1.0, 0xb40426], // dark red
]);

colormaps.addColorMap("RedBlue", [
    // red → white → blue (ColorBrewer RdBu 11)
    [0.0, 0x67001f], // dark red
    [0.1, 0xb2182b],
    [0.2, 0xd6604d],
    [0.3, 0xf4a582],
    [0.4, 0xfddbc7],
    [0.5, 0xf7f7f7], // white
    [0.6, 0xd1e5f0],
    [0.7, 0x92c5de],
    [0.8, 0x4393c3],
    [0.9, 0x2166ac],
    [1.0, 0x053061], // dark blue
]);

colormaps.addColorMap("RedYelBlue", [
    // red → yellow → blue (ColorBrewer RdYlBu 11)
    [0.0, 0xa50026], // dark red
    [0.1, 0xd73027],
    [0.2, 0xf46d43],
    [0.3, 0xfdae61],
    [0.4, 0xfee090],
    [0.5, 0xffffbf], // pale yellow
    [0.6, 0xe0f3f8],
    [0.7, 0xabd9e9],
    [0.8, 0x74add1],
    [0.9, 0x4575b4],
    [1.0, 0x313695], // dark blue
]);

colormaps.addColorMap("Spectral", [
    // red → orange → yellow → green → blue (ColorBrewer Spectral 11)
    [0.0, 0x9e0142], // dark red
    [0.1, 0xd53e4f],
    [0.2, 0xf46d43],
    [0.3, 0xfdae61],
    [0.4, 0xfee08b],
    [0.5, 0xffffbf], // pale yellow
    [0.6, 0xe6f598],
    [0.7, 0xabdda4],
    [0.8, 0x66c2a5],
    [0.9, 0x3288bd],
    [1.0, 0x5e4fa2], // purple-blue
]);

colormaps.addColorMap("YellowRed", [
    // deep red → orange → bright yellow, all warm saturated tones
    [0.0, 0x880000],
    [0.1, 0xaa0000],
    [0.2, 0xbb0000],
    [0.3, 0xcc1100],
    [0.4, 0xdd2200],
    [0.5, 0xee4400],
    [0.6, 0xff6600],
    [0.7, 0xff8800],
    [0.8, 0xffaa00],
    [0.9, 0xffcc00],
    [1.0, 0xffff00],
]);

colormaps.addColorMap("GreenBlue", [
    // deep blue → teal → forest green, staying saturated throughout
    [0.0, 0x0a0e8f],
    [0.1, 0x1218bb],
    [0.2, 0x1a2dcc],
    [0.3, 0x1a44cc],
    [0.4, 0x1a60cc],
    [0.5, 0x1a7fc4],
    [0.6, 0x1a8fa0],
    [0.7, 0x1a9478],
    [0.8, 0x1a8c5a],
    [0.9, 0x1a7a3a],
    [1.0, 0x1a5e1a],
]);

colormaps.addColorMap("PurpleGold", [
    // deep purple → magenta → orange → gold, through warm saturated hues
    [0.0, 0x280060],
    [0.1, 0x4a0080],
    [0.2, 0x7a0099],
    [0.3, 0x9c1aaa],
    [0.4, 0xbb3388],
    [0.5, 0xcc5555],
    [0.6, 0xcc7733],
    [0.7, 0xcc9911],
    [0.8, 0xddbb00],
    [0.9, 0xeecf00],
    [1.0, 0xffd700],
]);

colormaps.addColorMap("CyanRed", [
    // red → purple → blue → cyan, traversing hue space through saturated tones
    [0.0, 0xff0000],
    [0.1, 0xdd0000],
    [0.2, 0xcc0000],
    [0.3, 0xaa1122],
    [0.4, 0x882244],
    [0.5, 0x660066],
    [0.6, 0x442288],
    [0.7, 0x1144aa],
    [0.8, 0x0077cc],
    [0.9, 0x00aadd],
    [1.0, 0x00e5ff],
]);

colormaps.addColorMap("BlueRed", [
    // deep blue → purple → crimson, staying dark and saturated
    [0.0, 0x1a237e],
    [0.1, 0x283593],
    [0.2, 0x3949ab],
    [0.3, 0x5c6bc0],
    [0.4, 0x7e57c2],
    [0.5, 0x9c27b0],
    [0.6, 0xc2185b],
    [0.7, 0xd32f2f],
    [0.8, 0xc62828],
    [0.9, 0xb71c1c],
    [1.0, 0x7f0000],
]);

// Generate the categorical HSL colormap
const numCategories = 10; // Replace with the actual number of categories
const categoricalColormap: [number, number][] = [];
for (let i = 0; i < numCategories; i++) {
    const scalar = i / (numCategories - 1); // Normalized scalar in [0, 1]
    const hue = scalar * 0.75; // remove purple and red at the end op spectrum
    const color = new Color();
    color.setHSL(hue, 1, 0.4);
    categoricalColormap.push([scalar, color.getHex()]);
}
colormaps.addColorMap("HSL", categoricalColormap);
