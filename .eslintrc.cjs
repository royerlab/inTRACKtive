/* eslint-env node */
module.exports = {
    extends: [
        "eslint:recommended",
        "plugin:react/recommended",
        "plugin:@typescript-eslint/recommended",
        "prettier",
    ],
    parser: "@typescript-eslint/parser",
    plugins: ["react", "react-hooks", "@typescript-eslint", "prettier"],
    root: true,
    rules: {
        "react/react-in-jsx-scope": "off",
        "react/jsx-uses-react": "off",
        "camelcase": "error",
        "spaced-comment": "error",
        "semi": ["error", "always"],
        "quotes": ["error", "double"],
        "no-duplicate-imports": "error",
    },
    settings: {
        "import/resolver": {
            typescript: {}
        },
        "react": {
            "version": "detect"
        },
    },
};
