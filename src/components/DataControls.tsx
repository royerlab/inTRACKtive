import { useEffect, useState } from "react";

import { Alert, Box, Popover, Snackbar, Stack, Typography, styled } from "@mui/material";

import { Button, ButtonIcon, InputText, fontBodyXs } from "@czi-sds/components";

interface DataControlsProps {
    dataUrl: string;
    initialDataUrl: string;
    setDataUrl: (dataUrl: string) => void;
    copyShareableUrlToClipboard: () => void;
    validTrackManager: boolean;
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

    const handleDataUrlSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const urlInput = document.getElementById("data-url-input") as HTMLInputElement;
        if (urlInput) {
            props.setDataUrl(urlInput.value);
        }
    };

    // only close the popover if the URL gives a valid track manager
    useEffect(() => {
        if (props.validTrackManager && urlPopoverAnchor) {
            setUrlPopoverAnchor(null);
        }
    }, [props.validTrackManager]);

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
                disabled={!props.validTrackManager}
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
                disableRestoreFocus // this is needed to autofocus the input when opening
            >
                <form onSubmit={handleDataUrlSubmit}>
                    <Stack
                        spacing={4}
                        sx={{
                            padding: "1em",
                            width: "50vw",
                        }}
                    >
                        <label htmlFor="data-url-input">
                            <h5 style={{ margin: 0 }}>Zarr URL</h5>
                        </label>
                        <InputText
                            id="data-url-input"
                            autoFocus
                            label="Zarr URL"
                            hideLabel
                            placeholder={props.initialDataUrl}
                            defaultValue={props.dataUrl}
                            fullWidth={true}
                            intent={props.validTrackManager ? "default" : "error"}
                        />
                        <Note>
                            <strong>Note:</strong> Changing this URL will replace the image and reset the canvas.
                        </Note>
                        <Stack direction="row" spacing={4}>
                            <Button sdsStyle="square" sdsType="secondary" onClick={handleUrlPopoverClose}>
                                Cancel
                            </Button>
                            <Button sdsStyle="square" sdsType="primary" type="submit">
                                Apply
                            </Button>
                        </Stack>
                    </Stack>
                </form>
            </Popover>
        </Box>
    );
}

const Note = styled(Typography)`
    ${fontBodyXs}
`;