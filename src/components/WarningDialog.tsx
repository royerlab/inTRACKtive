import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";

interface WarningDialogProps {
    open: boolean;
    numUnfetchedPoints: number;
    onCloseAction: () => void;
    onContinueAction: () => void;
}

export default function WarningDialog(props: WarningDialogProps) {
    return (
        <Dialog open={props.open} onClose={props.onCloseAction}>
            <DialogTitle>Warning</DialogTitle>
            <DialogContent>
                {`You have selected ${props.numUnfetchedPoints} new cells, which might take a long time to load. Continue?`}
            </DialogContent>
            <DialogActions>
                <Button onClick={props.onCloseAction} color="primary">
                    Cancel
                </Button>
                <Button onClick={props.onContinueAction}>Continue</Button>
            </DialogActions>
        </Dialog>
    );
}
