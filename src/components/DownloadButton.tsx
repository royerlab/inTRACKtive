import { Button } from "@czi-sds/components";

// TrackDownloadData is a list for each point
// It contains trackID, time, x, y, z, parentTrackID
export type TrackDownloadData = [number, number, number, number, number, number];
interface DownloadButtonProps {
    getDownloadData: () => string[][];
}

const dataHeaders = ["track_id", "t", "x", "y", "z", "parent_track_id"];

const convertToCSV = (nestedArray: string[][]) => {
    return nestedArray.map((row) => row.join(",")).join("\r\n");
};

export const DownloadButton = (props: DownloadButtonProps) => {
    const downloadCSV = () => {
        const data = props.getDownloadData();
        const csvData = new Blob([`${convertToCSV([dataHeaders])}\r\n${convertToCSV(data)}`], { type: "text/csv" });
        const csvURL = URL.createObjectURL(csvData);
        const link = document.createElement("a");
        link.href = csvURL;
        link.download = "points.csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Button sdsStyle="square" sdsType="primary" onClick={downloadCSV}>
            Export Cell Tracks
        </Button>
    );
};
