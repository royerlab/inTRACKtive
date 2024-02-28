// Adapted from jotai-location atomWithHash
// https://github.com/jotaijs/jotai-location/blob/ec13c46d3458ff857e526a0abfbb9022300fb41b/src/atomWithHash.ts
//
// Changes:
// - becomes a custom React hook instead of
// - simplifies options/behavior
// - TODO: allows whole fragment to be encoded/decoded

import { Dispatch, SetStateAction, useEffect, useState } from "react";

export function getStateFromUrlHash<Value>(key: string, defaultValue: Value): Value {
    const searchParams = new URLSearchParams(window.location.hash.slice(1));
    const serializedValue = searchParams.get(key);
    let value = JSON.parse(serializedValue!);
    console.log("getStateFromUrlHash: %s, %s", key, JSON.stringify(value));
    if (!value) {
        value = defaultValue;
    }
    return value;
}

export function reuseStateInUrlHash<Value>(
    key: string,
    value: Value,
    setValue: Dispatch<SetStateAction<Value>>,
): [Value, Dispatch<SetStateAction<Value>>] {
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
        // I cannot believe we'd want every state change in history because that
        // would quickly pollute the user's browser history, so replace it directly
        // instead of just updating the hash (which will append).
        // window.location.hash = searchParams.toString();
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${searchParams}`);
    }, [value]);

    return [value, setValue];
}

export function useStateInUrlHash<Value> (
    key: string,
    defaultValue: Value,
): [Value, Dispatch<SetStateAction<Value>>] {
    const initialValue = getStateFromUrlHash<Value>(key, defaultValue);
    const [value, setValue] = useState<Value>(initialValue);
    return reuseStateInUrlHash<Value>(key, value, setValue);
}
