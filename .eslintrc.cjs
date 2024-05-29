/* eslint-env node */
module.exports = {
    extends: [
        "eslint:recommended",
        "plugin:react/recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:prettier/recommended",
    ],
    parser: "@typescript-eslint/parser",
    plugins: ["react", "react-hooks", "@typescript-eslint", "prettier"],
    root: true,
    rules: {
        "react/react-in-jsx-scope": "off",
        "react/jsx-uses-react": "off",
        "react-hooks/rules-of-hooks": "error", // Enforce Rules of Hooks
        // TODO: change exhaustive-deps to error
        "react-hooks/exhaustive-deps": "warn", // Enforce effect dependencies
        "camelcase": "error",
        "spaced-comment": "error",
        "semi": ["error", "always"],
        "quotes": ["error", "double"],
        "no-duplicate-imports": "error",
        // ignore unused vars that start with _
        // https://stackoverflow.com/a/64067915/333308
        // note you must disable the base rule
        // as it can report incorrect errors
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": [
            "error",
            {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
                caughtErrorsIgnorePattern: "^_",
            },
        ],
    },
    settings: {
        "import/resolver": {
            typescript: {},
        },
        "react": {
            version: "detect",
        },
    },
};
