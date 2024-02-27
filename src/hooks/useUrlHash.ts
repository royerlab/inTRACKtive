// Adapted from jotai-location atomWithHash
// https://github.com/jotaijs/jotai-location/blob/ec13c46d3458ff857e526a0abfbb9022300fb41b/src/atomWithHash.ts
//
// Changes:
// - becomes a custom React hook instead of
// - simplifies options/behavior
// - allows whole fragment to be encoded/decoded

import { Dispatch, SetStateAction, useEffect, useState } from "react";

export default function useStateInUrlHash<Value>(
    key: string,
    initialValue: Value,
): [Value, Dispatch<SetStateAction<Value>>] {
    const [value, setValue] = useState<Value>(initialValue);

    // We want to set the React state value of this based on its value in the hash
    // whenever the hash changes.
    const setStateFromHash = () => {
        const searchParams = new URLSearchParams(window.location.hash.slice(1));
        const serializedValue = searchParams.get(key);
        // TODO: handle null values?
        const deserializedValue = JSON.parse(serializedValue!);
        setValue(deserializedValue);
    };
    // Only want to register event listener to hash changes once on mount.
    useEffect(() => {
        window.addEventListener("hashchange", setStateFromHash);
        return () => {
            window.removeEventListener("hashchange", setStateFromHash);
        };
    }, []);

    // Use URLSearchParams as a safe key/value store and update the hash whenever
    // it changes.
    // TODO: allow base64 encoding for shorter URLs.
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.hash.slice(1));
        const serializedValue = JSON.stringify(value);
        searchParams.set(key, serializedValue);
        window.location.hash = searchParams.toString();
    }, [value]);

    return [value, setValue];
}
