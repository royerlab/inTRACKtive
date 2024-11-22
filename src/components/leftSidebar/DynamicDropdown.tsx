import React, { useState } from "react";
import { AutocompleteValue } from "@mui/base";
import { InputDropdown, DropdownMenu, SDSAutocompleteOnChange } from "@czi-sds/components";

export type Option = {
    name: string;
    label: number;
    type: "default" | "categorical" | "continuous";
    action: "default" | "calculate" | "provided";
    numCategorical: number | undefined;
};

interface DropdownProps {
    options: Option[];
    onClick: (event: string) => void;
}

// Define a constant for the default list of options
const DEFAULT_DROPDOWN_OPTIONS: Option[] = [
    { name: "uniform", label: 0, type: "default", action: "default", numCategorical: undefined },
    { name: "x-position", label: 1, type: "continuous", action: "calculate", numCategorical: undefined },
    { name: "y-position", label: 2, type: "continuous", action: "calculate", numCategorical: undefined },
    { name: "z-position", label: 3, type: "continuous", action: "calculate", numCategorical: undefined },
    { name: "sign(x-pos)", label: 4, type: "categorical", action: "calculate", numCategorical: 2 },
    { name: "quadrants", label: 5, type: "categorical", action: "calculate", numCategorical: 8 },
];

export const numberOfDefaultColorByOptions = DEFAULT_DROPDOWN_OPTIONS.length;
// Initialize the mutable dropdown options with the default options
export const dropDownOptions: Option[] = [...DEFAULT_DROPDOWN_OPTIONS];

// Function to reset the dropdown options to the default list
export function resetDropDownOptions() {
    // Clear the current array and reset it to the default options
    dropDownOptions.length = 0;
    dropDownOptions.push(...DEFAULT_DROPDOWN_OPTIONS);
    console.debug("DropDownOptions reset to default.");
}

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
