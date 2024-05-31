import { Callout } from "@czi-sds/components";

export default function ControlInstructions() {
    return (
        <Callout title="Select Cells" intent="info" sx={{ width: "auto" }}>
            Hold shift + click and drag on the canvas to select cell points
        </Callout>
    );
}
