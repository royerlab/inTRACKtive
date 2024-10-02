import { Callout } from "@czi-sds/components";

import { PointSelectionMode } from "@/lib/PointSelector";

interface ControlInstructionsProps {
    selectionMode: PointSelectionMode | null;
    isTablet: boolean;
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
                    <p>
                        Hold <strong>Shift</strong> and the selector will follow your cursor.
                    </p>
                    <p>
                        <strong>Shift-Click</strong> to select cells within the sphere.
                    </p>
                    <em>Additional controls:</em>
                    <ul style={{ paddingLeft: "15px", marginLeft: "0" }}>
                        <li>
                            <strong>ctrl+scroll</strong>: scale sphere
                        </li>
                        <li>
                            <strong>s</strong>: show/hide sphere
                        </li>
                    </ul>
                </>
            );
            break;
        case PointSelectionMode.SPHERE:
            instructionText = (
                <>
                    {props.isTablet && (
                        <p>If using a tablet without keyboard, use the UI controls above to select cells and scale the selector</p>
                    )}
                    <p>
                        <strong>Shift-click</strong> to select cells within the selector.
                    </p>
                    <em>Additional controls:</em>
                    <ul style={{ paddingLeft: "15px", marginLeft: "0" }}>
                        <li>
                            <strong>w</strong>: position
                        </li>
                        <li>
                            <strong>e</strong>: rotation
                        </li>
                        <li>
                            <strong>r</strong>: scale
                        </li>
                        <li>
                            <strong>Ctrl+scroll</strong>: scale
                        </li>
                        <li>
                            <strong>s</strong>: show/hide selector
                        </li>
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
