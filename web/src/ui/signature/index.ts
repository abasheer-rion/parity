// The signature chart system (DEC-0067): animated, step-driven charts on our tokens.
//
//   renderSignature(visual, s, { size, theme })  SVG markup for one frame (also in Node)
//   signatureSvg(visual, s, options)             a whole SVG document
//   signatureTable(visual)                       the numbers behind it, for a data table
//   <SignaturePlayer visual={...} />              the player: steps, autoplay, slider, table
export { renderSignature, signatureSvg, signatureTable, fmtOf, SCENES, SCENE_KINDS, type SigVisual, type SigStep, type SigTable, type RenderOptions, type FmtName } from "./scenes";
export { SignaturePlayer, SignatureFrame, SignatureTable, type SignaturePlayerProps } from "./Player";
export { SIZES, THEMES, type SizeName, type ThemeName, type Tone } from "./theme";
export { EXAMPLES } from "./examples";
