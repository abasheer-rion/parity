// Files the Cloudflare functions import as modules: the renderer's WebAssembly and the
// font files (named .bin so the bundler hands them over as bytes).
declare module "*.wasm" {
  const mod: WebAssembly.Module;
  export default mod;
}
declare module "*.bin" {
  const data: ArrayBuffer;
  export default data;
}
