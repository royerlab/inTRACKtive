import { Tag } from "@czi-sds/components";
import "@czi-sds/components/dist/variables.css";

interface TimestampOverlayProps {
    timestamp: number | undefined; // Currently timestamp is a frame number, but it could be the actual timestamp
}

export const TimestampOverlay = (props: TimestampOverlayProps) => {
    return (
        <Tag
            label={props.timestamp !== undefined ? `cell = ${props.timestamp.toString()}` : "-"}
            sdsStyle="square"
            sdsType="secondary"
            size="small"
            sx={{
                position: "absolute",
                bottom: "0.5rem",
                left: "0.5rem",
                backgroundColor: "rgba(255, 255, 255, 0.6)",
                zIndex: 100,
                borderRadius: "var(--sds-corner-m)",
            }}
            tagColor={["#EAEAEA", "#545454"]}
        />
    );
};
