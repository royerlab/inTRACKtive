import { expect, test } from "vitest";

import Scene from "../src/scene";
import React from "react";
import { render } from "@testing-library/react";

test("tests work", () => {
    expect(true).toBeTruthy();
});

test("render Scene", () => {
    const { container } = render(<Scene renderWidth={800} />);
    expect(container).not.toBeNull();
});
