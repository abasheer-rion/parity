// Stylesheets read the design tokens only (DEC-0058). Raw colours, px font sizes, raw
// durations, curves and z-index numbers belong in src/ui/tokens.css and nowhere else.
// Run with `npm run lint:styles`; CI runs it on every pull request.
export default {
  plugins: ["./stylelint/parity-tokens.mjs"],
  ignoreFiles: ["src/ui/tokens.css", "dist/**", "node_modules/**"],
  rules: {
    "color-no-hex": [true, { message: "Raw hex colour: use a --color-* token from src/ui/tokens.css" }],
    "color-named": ["never", { message: "Named colour: use a --color-* token from src/ui/tokens.css" }],
    "function-disallowed-list": [["rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch", "color"], { message: "Raw colour function: use a --color-* token, or color-mix() of tokens" }],
    "parity/tokens": true,
  },
};
