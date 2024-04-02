import { TrackManager } from "@/lib/TrackManager";
import { ButtonIcon } from "@czi-sds/components";
import { Box } from "@mui/material";

interface DataControlsProps {
    dataUrl: string;
    initialDataUrl: string;
    setDataUrl: (dataUrl: string) => void;
    copyShareableUrlToClipboard: () => void;
    trackManager: TrackManager | null; // TODO: remove this?
}

export default function DataControls(props: DataControlsProps) {
    return (
        <Box sx={{ display: "flex", flexDirection: "row", justifyContent: "space-between" }}>
            {/* TODO: make this do something */}
            <ButtonIcon sdsIcon="infoCircle" sdsSize="large" sdsType="secondary" />

            <ButtonIcon
                sdsIcon="share"
                sdsSize="large"
                sdsType="secondary"
                disabled={!props.trackManager}
                onClick={props.copyShareableUrlToClipboard}
            />

            {/* TODO: make this do something */}
            <ButtonIcon sdsIcon="globeBasic" sdsSize="large" sdsType="secondary" />
        </Box>
    );
}
