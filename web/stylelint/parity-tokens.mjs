// Stylelint rule `parity/tokens`: stylesheets take sizes, motion and layers from the design
// tokens (src/ui/tokens.css, DEC-0058), never raw values. Raw colours are caught by the
// built-in rules in stylelint.config.mjs; this rule covers what those cannot:
//   - a font size in px or pt (font-size, or the size in the `font` shorthand)
//   - a duration in a transition or animation, other than 0s (use --dur-*)
//   - a cubic-bezier() curve (use --ease-*)
//   - a page-level z-index, 10 or more either way (use --z-*); -9 to 9 orders the parts
//     inside one component and is allowed
// tokens.css itself is ignored in the config, since it is where the values live.
import stylelint from "stylelint";

const { createPlugin, utils: { report, ruleMessages, validateOptions } } = stylelint;
const ruleName = "parity/tokens";
const messages = ruleMessages(ruleName, {
  fontSize: (v) => `Font size "${v}": use a --type-* token`,
  duration: (v) => `Duration "${v}": use a --dur-* token`,
  curve: () => `cubic-bezier(): use an --ease-* token`,
  zIndex: (v) => `z-index ${v}: use a --z-* token`,
});

// Strips var(...) and url(...) so values inside them are not read as raw.
const bare = (value) => value.replace(/url\([^)]*\)/g, "").replace(/var\([^()]*\)/g, "");

const rule = (enabled) => (root, result) => {
  if (!validateOptions(result, ruleName, { actual: enabled, possible: [true, false] }) || !enabled) return;
  root.walkDecls((decl) => {
    const prop = decl.prop.toLowerCase();
    const value = bare(decl.value);
    const flag = (message, word) => report({ ruleName, result, node: decl, message, word });
    // A local alias (--a-fs, --dur) must point at a token too, or it is a loophole.
    if (prop.startsWith("--")) {
      if (/(^|-)(fs|font-size|font|type|text-size)(-|$)/.test(prop.slice(2))) {
        const m = value.match(/(?<![\w.-])\d*\.?\d+(px|pt)\b/);
        if (m) flag(messages.fontSize(m[0]), m[0]);
      }
      const d = [...value.matchAll(/(?<![\w.-])(\d*\.?\d+)(ms|s)\b/g)].find((m) => Number(m[1]) !== 0);
      if (d) flag(messages.duration(d[0]), d[0]);
      if (/cubic-bezier\(/.test(value)) flag(messages.curve(), "cubic-bezier");
      return;
    }

    if (prop === "font-size") {
      const m = value.match(/(?<![\w.-])\d*\.?\d+(px|pt)\b/);
      if (m) flag(messages.fontSize(m[0]), m[0]);
    } else if (prop === "font") {
      // The size is the first length before an optional /line-height.
      const m = value.match(/(?<![\w.\/-])(\d*\.?\d+)(px|pt)(?=\s*\/|\s+["'a-z])/i);
      if (m) flag(messages.fontSize(m[0]), m[0]);
    }
    if (/^(transition|animation)/.test(prop)) {
      for (const m of value.matchAll(/(?<![\w.-])(\d*\.?\d+)(ms|s)\b/g)) {
        if (Number(m[1]) === 0) continue;
        flag(messages.duration(m[0]), m[0]);
      }
    }
    if (/cubic-bezier\(/.test(value)) flag(messages.curve(), "cubic-bezier");
    if (prop === "z-index") {
      const m = value.trim().match(/^-?\d+$/);
      if (m && Math.abs(Number(m[0])) > 9) flag(messages.zIndex(m[0]), m[0]);
    }
  });
};
rule.ruleName = ruleName;
rule.messages = messages;

export default createPlugin(ruleName, rule);
