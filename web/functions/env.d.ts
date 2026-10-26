// Shared modules under src/ read import.meta.env?.DEV, which Vite fills in for the browser.
// In Pages Functions import.meta.env does not exist, so it is optional here.
interface ImportMeta {
  readonly env?: { readonly DEV?: boolean; readonly [key: string]: unknown };
}
