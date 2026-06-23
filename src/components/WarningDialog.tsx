import { Box, Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";

interface WarningDialogProps {
    open: boolean;
    numUnfetchedPoints: number;
    message?: string;
    onCloseAction: () => void;
    onContinueAction: () => void;
}

export default function WarningDialog(props: WarningDialogProps) {
    const message =
        props.message ??
        `You have selected ${props.numUnfetchedPoints} new cells, which might take a long time to load. Continue?`;
    return (
        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "2em" }}>
            <Dialog open={props.open} onClose={props.onCloseAction}>
                <DialogTitle>Warning</DialogTitle>
                <DialogContent>{message}</DialogContent>
                <DialogActions>
                    <Button onClick={props.onCloseAction} color="primary">
                        Cancel
                    </Button>
                    <Button onClick={props.onContinueAction}>Continue</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
