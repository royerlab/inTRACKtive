import { useState } from "react";

import { Box, Popover, Stack, Typography } from "@mui/material";
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
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
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
            <ButtonIcon sdsIcon="infoCircle" sdsSize="large" sdsType="secondary" />

            <ButtonIcon
                sdsIcon="share"
                sdsSize="large"
                sdsType="secondary"
                disabled={!props.trackManager}
                onClick={props.copyShareableUrlToClipboard}
            />

            {/* TODO: make this do something */}
            <ButtonIcon sdsIcon="globeBasic" sdsSize="large" sdsType="secondary" onClick={handleClick} />
            <Popover
                open={Boolean(anchorEl)}
                anchorEl={anchorEl}
                onClose={handleClose}
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
                        <Button sdsStyle="square" sdsType="secondary" onClick={handleClose}>
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
