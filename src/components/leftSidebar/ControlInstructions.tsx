import { Callout } from "@czi-sds/components";

interface ControlInstructionsProps {
    selectionMode: string;
}

export default function ControlInstructions(props: ControlInstructionsProps) {
    let instructionText = <></>;
    switch (props.selectionMode) {
        case "box":
            instructionText = <p>Hold shift + click and drag to select cells.</p>;
            break;
        case "spherical-cursor":
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
        case "sphere":
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
