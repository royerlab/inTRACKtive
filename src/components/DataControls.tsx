import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Popover, Snackbar, Stack } from "@mui/material";

import { Button, ButtonIcon, InputText } from "@czi-sds/components";
import { ControlLabel, Note } from "@/components/Styled";

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

    // assign some props to local variables to satisfy the hook dependency linter, otherwise it
    // wants all of props to be in the dependency array, and this is nicer than destrcuturing all of
    // the props

    const copyShareableUrlToClipboard = props.copyShareableUrlToClipboard;
    const copyShareableUrlToClipBoard = useCallback(() => {
        copyShareableUrlToClipboard();
        setCopyUrlSnackBarOpen(true);
    }, [copyShareableUrlToClipboard]);

    const handleShareableUrlSnackBarClose = useCallback(() => {
        setCopyUrlSnackBarOpen(false);
    }, [setCopyUrlSnackBarOpen]);

    const showUrlPopover = useCallback(
        (event: React.MouseEvent<HTMLButtonElement>) => {
            setUrlPopoverAnchor(event.currentTarget);
        },
        [setUrlPopoverAnchor],
    );

    const handleUrlPopoverClose = useCallback(() => {
        setUrlPopoverAnchor(null);
    }, [setUrlPopoverAnchor]);

    const setDataUrl = props.setDataUrl;
    const handleDataUrlSubmit = useCallback(
        (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const urlInput = document.getElementById("data-url-input") as HTMLInputElement;
            if (urlInput) {
                setDataUrl(urlInput.value);
            }
        },
        [setDataUrl],
    );

    // only close the popover if the URL gives a valid track manager
    const validTrackManager = props.validTrackManager;
    useEffect(() => {
        if (validTrackManager) {
            setUrlPopoverAnchor(null);
        }
    }, [validTrackManager]);

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
                icon="InfoCircle"
                sdsSize="large"
                sdsType="secondary"
                onClick={() => {
                    window.alert("Not implemented :)");
                }}
            />

            <ButtonIcon
                icon="Share"
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

            <ButtonIcon icon="GlobeBasic" sdsSize="large" sdsType="secondary" onClick={showUrlPopover} />
            <Popover
                open={!!urlPopoverAnchor}
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
                        spacing={"2em"}
                        sx={{
                            padding: "1em",
                            width: "50vw",
                        }}
                    >
                        <label htmlFor="data-url-input">
                            <ControlLabel>Zarr URL</ControlLabel>
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
                        <Stack direction="row" spacing={"2em"}>
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
