import { Button } from "@czi-sds/components";

// TrackDownloadData is a list for each point
// It contains trackID, time, x, y, z, parentTrackID
export type TrackDownloadData = [number, number, number, number, number, number];
interface DownloadButtonProps {
    getDownloadData: () => TrackDownloadData[];
}

const dataHeaders = ["track_id", "t", "x", "y", "z", "parent_track_id"];

const convertToCSV = (nestedArray: TrackDownloadData[] | string[][]) => {
    let csvString = "";

    nestedArray.forEach((row) => {
        let line = "";
        row.forEach((entry) => {
            if (line !== "") line += ",";

            line += entry;
        });
        csvString += line + "\r\n";
    });
    return csvString;
};

export const DownloadButton = (props: DownloadButtonProps) => {
    const downloadCSV = () => {
        const data = props.getDownloadData();
        const csvData = new Blob([`${convertToCSV([dataHeaders])}${convertToCSV(data)}`], { type: "text/csv" });
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
