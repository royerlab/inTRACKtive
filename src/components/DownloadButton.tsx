import { TrackManager } from "@/lib/TrackManager";
import { Button } from "@czi-sds/components";

interface DownloadButtonProps {
    trackManager: TrackManager;
}

const dummyData = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
];

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
        const csvData = new Blob([convertToCSV(dummyData)], { type: "text/csv" });
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
