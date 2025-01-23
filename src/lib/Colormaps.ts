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

colormaps.addColorMap("magma-inferno", [
    // magma_inv + inferno
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
colormaps.addColorMap("plasma-inferno", [
    // plasma_inv + inferno
    [0.0, 0x0d0887],
    [0.05, 0x41049d],
    [0.1, 0x6a00a8],
    [0.15, 0x8f0da4],
    [0.2, 0xb12a90],
    [0.25, 0xcc4778],
    [0.3, 0xe16462],
    [0.35, 0xf2844b],
    [0.4, 0xfca636],
    [0.45, 0xfcce25],
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
