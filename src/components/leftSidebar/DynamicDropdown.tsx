// DynamicDropdown.tsx

import React, { useState } from "react";
import { FormControl, InputLabel, Select, MenuItem, SelectChangeEvent } from "@mui/material";

interface DropdownProps {
    options: { label: string; value: number }[];
    // updateOptions: (newOptions: { label: string; value: number }[]) => void;
    onClick: (event: number) => void;
}

export default function DynamicDropdown({ options, onClick }: DropdownProps) {
    // Set the default to the first option's value
    // const [selectedValue, setSelectedValue] = useState(options[0]?.value || "");
    const [selectedValue, setSelectedValue] = useState<number | "">(options[0]?.value || "");

    const handleChange = (event: SelectChangeEvent<number>) => {
        setSelectedValue(event.target.value as number);
        onClick(event.target.value as number);
    };

    return (
        <FormControl sx={{ m: 1, minWidth: 120, maxWidth: 250 }}>
            <InputLabel id="dynamic-select-label">Color by</InputLabel>
            <Select
                labelId="dynamic-select-label"
                id="dynamic-select"
                value={selectedValue}
                onChange={handleChange}
                label="Color by"
                autoWidth
            >
                {options.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                        {option.label}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}
