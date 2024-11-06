import React, { useState } from "react";
import { AutocompleteValue } from "@mui/base";
import { InputDropdown, DropdownMenu, SDSAutocompleteOnChange } from "@czi-sds/components";

export type Option = { name: string; label: number };
interface DropdownProps {
    options: Option[];
    onClick: (event: number) => void;
}

export default function DynamicDropdown({ options, onClick }: DropdownProps) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [open, setOpen] = useState(false);
    const [inputDropdownValue, setInputDropdownValue] = useState<string>();
    const [value, setValue] = useState<AutocompleteValue<Option, false, false, false> | null>(null);

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
            setInputDropdownValue(newValue.name);
            onClick(newValue.label);
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
                label="Color by"
                onClick={handleClick}
                sdsStyle="rounded"
                multiple={false}
                value={inputDropdownValue}
            />
            <DropdownMenu
                open={open}
                anchorEl={anchorEl}
                // onClose={noop}
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
