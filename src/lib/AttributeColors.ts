export type NumericAttribute = number[] | Float32Array;

type AttributeSelection = { label: number; type: string };

export function selectRgbAttributes<T extends AttributeSelection>(options: T[]): T[] {
    const labels = new Set<number>();
    return options
        .filter((option) => option.type === "continuous" && !labels.has(option.label) && labels.add(option.label))
        .slice(0, 3);
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
    const colors = new Float32Array(numPoints * 3);

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
            colors[point * 3 + channel] =
                normalizeValue(attribute[point], min, range, preNormalized[channel]) * brightness;
        }
    });

    return colors;
}
