export type NumericAttribute = number[] | Float32Array;

type AttributeSelection = { label: number; type: string };

export const RGB_BACKGROUND = 0.08;

export function selectRgbAttributes<T extends AttributeSelection>(options: Array<T | null>): Array<T | null> {
    const labels = new Set<number>();
    return options.slice(0, 3).map((option) => {
        if (option === null || option.type !== "continuous" || labels.has(option.label)) return null;
        labels.add(option.label);
        return option;
    });
}

function normalizeValue(value: number, min: number, range: number, preNormalized: boolean): number {
    const normalized = preNormalized ? value : range === 0 ? 1 : (value - min) / range;
    return Number.isFinite(normalized) ? Math.min(1, Math.max(0, normalized)) : 0;
}

export function composeRgbAttributes(
    attributes: NumericAttribute[],
    preNormalized: boolean[],
    numPoints: number,
    brightness: number,
): Float32Array {
    const colors = new Float32Array(numPoints * 3).fill(RGB_BACKGROUND * brightness);

    attributes.slice(0, 3).forEach((attribute, channel) => {
        let min = Infinity;
        let max = -Infinity;
        if (!preNormalized[channel]) {
            for (const value of attribute) {
                if (!Number.isFinite(value)) continue;
                min = Math.min(min, value);
                max = Math.max(max, value);
            }
        }
        const range = max - min;

        for (let point = 0; point < Math.min(numPoints, attribute.length); point++) {
            colors[point * 3 + channel] = Math.max(
                RGB_BACKGROUND * brightness,
                normalizeValue(attribute[point], min, range, preNormalized[channel]) * brightness,
            );
        }
    });

    return colors;
}
