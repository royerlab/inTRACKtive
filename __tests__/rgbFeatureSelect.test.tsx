import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { RgbFeatureSelect } from "../src/components/leftSidebar/TrackControls";
import { Option } from "../src/lib/TrackManager";

const feature = (name: string, label: number): Option => ({
    name,
    label,
    type: "continuous",
    action: "provided-normalized",
    numCategorical: undefined,
});

describe("RgbFeatureSelect", () => {
    test("provides an independent searchable input for each color channel", () => {
        const options = [feature("gata1a", 6), feature("foxd3", 7)];
        const onRedChange = vi.fn();

        render(
            <>
                <RgbFeatureSelect channel="Red" options={options} value={null} onChange={onRedChange} />
                <RgbFeatureSelect channel="Green" options={options} value={null} onChange={vi.fn()} />
                <RgbFeatureSelect channel="Blue" options={options} value={null} onChange={vi.fn()} />
            </>,
        );

        const redInput = screen.getByLabelText("Red feature");
        const greenInput = screen.getByLabelText("Green feature");
        const blueInput = screen.getByLabelText("Blue feature");
        expect(redInput).toBeTruthy();
        expect(greenInput).toBeTruthy();
        expect(blueInput).toBeTruthy();
        expect(getComputedStyle(redInput.closest(".MuiAutocomplete-root")!).backgroundColor).toBe(
            "rgba(255, 80, 80, 0.12)",
        );
        expect(getComputedStyle(greenInput.closest(".MuiAutocomplete-root")!).backgroundColor).toBe(
            "rgba(60, 180, 90, 0.12)",
        );
        expect(getComputedStyle(blueInput.closest(".MuiAutocomplete-root")!).backgroundColor).toBe(
            "rgba(70, 130, 255, 0.12)",
        );

        fireEvent.change(redInput, { target: { value: "gata" } });
        fireEvent.click(screen.getByRole("option", { name: "gata1a" }));

        expect(onRedChange).toHaveBeenCalledWith(options[0]);
    });
});
