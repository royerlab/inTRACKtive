import { Button } from "@czi-sds/components";

// TrackDownloadData is a tuple of trackID and parentTrackID
export type TrackDownloadData = [number, number];
interface DownloadButtonProps {
    getDownloadData: () => TrackDownloadData[];
}

const dataHeaders = ["trackID", "parentTrackID"];

const convertToCSV = (nestedArray: (string | number)[][]) => {
    let csvString = "";

    for (let row = 0; row < nestedArray.length; row++) {
        let line = "";
        for (const entry in nestedArray[row]) {
            if (line !== "") line += ",";

            line += nestedArray[row][entry];
        }
        csvString += line + "\r\n";
    }
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

    return <Button onClick={downloadCSV}>Download CSV</Button>;
};
