import { useState } from "react";

import { Alert, Box, Popover, Snackbar, Stack, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { fontBodyXs } from "czifui";

import { Button, ButtonIcon, InputText } from "@czi-sds/components";

import { TrackManager } from "@/lib/TrackManager";

interface DataControlsProps {
    dataUrl: string;
    initialDataUrl: string;
    setDataUrl: (dataUrl: string) => void;
    copyShareableUrlToClipboard: () => void;
    trackManager: TrackManager | null; // TODO: remove this?
}

export default function DataControls(props: DataControlsProps) {
    const [copyUrlSnackBarOpen, setCopyUrlSnackBarOpen] = useState(false);
    const [urlPopoverAnchor, setUrlPopoverAnchor] = useState<HTMLButtonElement | null>(null);

    const copyShareableUrlToClipBoard = () => {
        props.copyShareableUrlToClipboard();
        setCopyUrlSnackBarOpen(true);
    };

    const handleShareableUrlSnackBarClose = () => {
        setCopyUrlSnackBarOpen(false);
    };

    const showUrlPopover = (event: React.MouseEvent<HTMLButtonElement>) => {
        setUrlPopoverAnchor(event.currentTarget);
    };

    const handleUrlPopoverClose = () => {
        setUrlPopoverAnchor(null);
    };

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                // 5px margin makes this bar match the PlaybackControls height
                // because that component uses primary buttons, which hava a 5px margin
                margin: "5px",
            }}
        >
            {/* TODO: make this do something */}
            <ButtonIcon
                sdsIcon="infoCircle"
                sdsSize="large"
                sdsType="secondary"
                onClick={() => {
                    window.alert("Not implemented :)");
                }}
            />

            <ButtonIcon
                sdsIcon="share"
                sdsSize="large"
                sdsType="secondary"
                disabled={!props.trackManager}
                onClick={copyShareableUrlToClipBoard}
            />
            <Snackbar
                open={copyUrlSnackBarOpen}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                autoHideDuration={2500}
                onClose={handleShareableUrlSnackBarClose}
                // This is a hack to make the snackbar appear above the bottom bar
                sx={{
                    "&.MuiSnackbar-root": { bottom: "100px" },
                }}
            >
                <Alert
                    // SDS alert does not work in here
                    severity="success"
                    variant="filled"
                >
                    Shareable URL copied to clipboard!
                </Alert>
            </Snackbar>

            <ButtonIcon sdsIcon="globeBasic" sdsSize="large" sdsType="secondary" onClick={showUrlPopover} />
            <Popover
                open={Boolean(urlPopoverAnchor)}
                anchorEl={urlPopoverAnchor}
                onClose={handleUrlPopoverClose}
                anchorOrigin={{
                    vertical: "top",
                    horizontal: "right",
                }}
                transformOrigin={{
                    vertical: "bottom",
                    horizontal: "left",
                }}
            >
                <Stack
                    spacing={4}
                    sx={{
                        "padding": "1em",
                        "width": "768px",
                        "& > label": { fontSize: "0.83em", fontWeight: "bold" },
                    }}
                >
                    <InputText
                        id="url-input"
                        label="Zarr URL"
                        placeholder={props.initialDataUrl}
                        defaultValue={props.initialDataUrl}
                        onChange={(e) => props.setDataUrl(e.target.value)}
                        fullWidth={true}
                        intent={props.trackManager ? "default" : "error"}
                    />
                    <Note>
                        <strong>Note:</strong> Changing this URL will replace the image and reset the canvas.
                    </Note>
                    <Stack direction="row" spacing={4}>
                        <Button sdsStyle="square" sdsType="secondary" onClick={handleUrlPopoverClose}>
                            Cancel
                        </Button>
                        <Button sdsStyle="square" sdsType="primary">
                            Apply
                        </Button>
                    </Stack>
                </Stack>
            </Popover>
        </Box>
    );
}

const Note = styled(Typography)`
    ${fontBodyXs}
`;
