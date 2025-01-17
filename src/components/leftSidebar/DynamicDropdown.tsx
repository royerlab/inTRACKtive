import React, { useState } from "react";
import { AutocompleteValue } from "@mui/base";
import { InputDropdown, DropdownMenu, SDSAutocompleteOnChange } from "@czi-sds/components";
import { Option } from "@/lib/TrackManager";

interface DropdownProps {
    options: Option[];
    onClick: (event: string) => void;
}

export default function DynamicDropdown({ options, onClick }: DropdownProps) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [open, setOpen] = useState(false);
    const [inputDropdownValue, setInputDropdownValue] = useState<string | undefined>(options[0]?.name);
    const [value, setValue] = useState<AutocompleteValue<Option, false, false, false> | null>(options[0] || null);

    function handleClick(event: React.MouseEvent<HTMLElement>) {
        if (open) {
            setOpen(false);

            if (anchorEl) {
                anchorEl.focus();
            }

            setAnchorEl(null);
        } else {
            setAnchorEl(event.currentTarget);
            setOpen(true);
        }
    }

    const handleChange: SDSAutocompleteOnChange<Option, false, false, false> = (
        _: React.SyntheticEvent<Element, Event>,
        newValue: AutocompleteValue<Option, false, false, false>,
    ) => {
        setOpen(false);
        setValue(newValue);

        if (newValue) {
            setInputDropdownValue(newValue.name.substring(0, 14)); // only print the first 14 characters to prevent overflow
            onClick(newValue.name);
        } else {
            setInputDropdownValue(undefined);
        }
    };

    function handleClickAway() {
        if (open) {
            setOpen(false);
        }
    }

    return (
        <div>
            <InputDropdown
                label="Color"
                onClick={handleClick}
                sdsStyle="rounded"
                multiple={false}
                value={inputDropdownValue}
            />
            <DropdownMenu
                open={open}
                anchorEl={anchorEl}
                onChange={handleChange}
                search={false}
                multiple={false}
                disableCloseOnSelect
                options={options}
                value={value}
                onClickAway={handleClickAway}
            />
        </div>
    );
}
