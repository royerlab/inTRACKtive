import { Callout } from "@czi-sds/components";

import { PointSelectionMode } from "@/lib/PointCanvas";

interface ControlInstructionsProps {
    selectionMode: string;
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
                    <p>Shift-click to select cells within the sphere.</p>
                    <p>Additional controls:</p>
                    <ul>
                        <li>Space (hold): sphere follows cursor</li>
                        <li>Ctrl+scroll: scale sphere</li>
                        <li>s: show/hide sphere</li>
                    </ul>
                </>
            );
            break;
        case PointSelectionMode.SPHERE:
            instructionText = (
                <>
                    <p>Shift-click to select cells within the sphere.</p>
                    <p>Additional controls:</p>
                    <ul>
                        <li>Ctrl+scroll: scale</li>
                        <li>w: position mode</li>
                        <li>e: rotation mode</li>
                        <li>r: scale mode</li>
                        <li>s: show/hide sphere</li>
                    </ul>
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
