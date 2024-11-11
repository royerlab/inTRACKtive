import React, { useState } from "react";
import { AutocompleteValue } from "@mui/base";
import { InputDropdown, DropdownMenu, SDSAutocompleteOnChange } from "@czi-sds/components";

export type Option = {
    name: string;
    label: number;
    type: "default" | "categorical" | "continuous";
    action: "default" | "calculate" | "provided";
};

interface DropdownProps {
    options: Option[];
    onClick: (event: string) => void;
}

export const dropDownOptions: Option[] = [
    // built-in attributes (computed at execution time)
    { name: "uniform", label: 0, type: "default", action: "default" },
    { name: "x-position", label: 1, type: "continuous", action: "calculate" },
    { name: "y-position", label: 2, type: "continuous", action: "calculate" },
    { name: "z-position", label: 3, type: "continuous", action: "calculate" },
    { name: "sign(x-pos)", label: 4, type: "categorical", action: "calculate" },
    { name: "quadrants", label: 5, type: "categorical", action: "calculate" },
];

export function addDropDownOption(option: Option) {
    // Check if an option with the same name or label already exists
    const exists = dropDownOptions.some(
        (existingOption) => existingOption.name === option.name || existingOption.label === option.label,
    );

    // Add the option only if it does not exist
    if (!exists) {
        dropDownOptions.push(option);
        console.debug(`DropDownOption '${option.name}' added.`);
    } else {
        console.warn(`Option '${option.name}' already exists in dropDownOptions.`);
    }
}

export default function DynamicDropdown({ options, onClick }: DropdownProps) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [open, setOpen] = useState(false);
    const [inputDropdownValue, setInputDropdownValue] = useState<string | undefined>(options[0]?.name);
    const [value, setValue] = useState<AutocompleteValue<Option, false, false, false> | null>(options[0] || null);

    // useEffect(() => {
    //     // Call onClick with the default label if you'd like to trigger it on mount
    //     onClick(options[0].label);
    // }, [onClick, options]);

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
