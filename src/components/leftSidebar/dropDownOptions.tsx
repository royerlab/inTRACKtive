// dropDownOptions.tsx
import { useState } from "react";

// Define the option type
export interface DropdownOption {
    label: string;
    value: number;
}

// Create the custom hook
export function useDropdownOptions() {
    const [options, setOptions] = useState<DropdownOption[]>([
        { label: "uniform", value: 1 },
        { label: "x-position", value: 2 },
        { label: "y-position", value: 3 },
        { label: "z-position", value: 4 },
    ]);

    const updateOptions: (
        newOptions: DropdownOption[] | ((prevOptions: DropdownOption[]) => DropdownOption[]),
    ) => void = setOptions;

    return { options, updateOptions };
}
