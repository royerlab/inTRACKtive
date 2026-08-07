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

        expect(screen.getByLabelText("Red feature")).toBeTruthy();
        expect(screen.getByLabelText("Green feature")).toBeTruthy();
        expect(screen.getByLabelText("Blue feature")).toBeTruthy();

        fireEvent.change(screen.getByLabelText("Red feature"), { target: { value: "gata" } });
        fireEvent.click(screen.getByRole("option", { name: "gata1a" }));

        expect(onRedChange).toHaveBeenCalledWith(options[0]);
    });
});
