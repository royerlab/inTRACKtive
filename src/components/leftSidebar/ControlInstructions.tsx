import { Callout } from "@czi-sds/components";

import { PointSelectionMode } from "@/lib/PointSelector";

interface ControlInstructionsProps {
    selectionMode: PointSelectionMode | null;
}

export default function ControlInstructions(props: ControlInstructionsProps) {
    let instructionText = <></>;
    switch (props.selectionMode) {
        case PointSelectionMode.BOX:
            instructionText = <p>Hold shift + click and drag to select cells.</p>;
            break;
        case PointSelectionMode.SPHERICAL_CURSOR:
            instructionText = (
                <>
                    <p>Hold Shift and a sphere will follow your cursor, centering on nearby points.</p>
                    <p>Shift-Click to select cells within the sphere.</p>
                    <p>Additional controls:</p>
                    <p>Ctrl+scroll: scale sphere</p>
                    <p>s: show/hide sphere</p>
                </>
            );
            break;
        case PointSelectionMode.SPHERE:
            instructionText = (
                <>
                    <p>Shift-click to select cells within the sphere.</p>
                    <p>Additional controls:</p>
                    <p>w: position mode</p>
                    <p>e: rotation mode</p>
                    <p>r: scale mode</p>
                    <p>Ctrl+scroll: scale</p>
                    <p>s: show/hide sphere</p>
                </>
            );
            break;
    }
    return (
        <Callout title="Select Cells" intent="info" sx={{ width: "auto" }}>
            {instructionText}
        </Callout>
    );
}
