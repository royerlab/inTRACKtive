import { Box } from "@mui/material";
import { FontS } from "@/components/Styled";

interface TissueHoverOverlayProps {
    name: string;
    hexColor: number;
}

export const TissueHoverOverlay = ({ name, hexColor }: TissueHoverOverlayProps) => {
    const hexStr = `#${hexColor.toString(16).padStart(6, "0").toUpperCase()}`;
    return (
        <Box
            sx={{
                position: "absolute",
                bottom: "0.5rem",
                left: "0.5rem",
                zIndex: 100,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "rgba(0, 0, 0, 0.55)",
                borderRadius: "4px",
                padding: "4px 8px",
                pointerEvents: "none",
            }}
        >
            <Box
                sx={{
                    width: "0.9rem",
                    height: "0.9rem",
                    borderRadius: "2px",
                    backgroundColor: hexStr,
                    flexShrink: 0,
                }}
            />
            <FontS sx={{ color: "white", margin: 0 }}>{name}</FontS>
        </Box>
    );
};
