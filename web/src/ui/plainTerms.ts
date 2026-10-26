// Inside a control such as a sortable column header, a glossary term must not be a link:
// a link inside a button is two controls in one, and clicking the header opened the
// glossary instead of sorting. Terms rendered inside this context show as text that still
// opens the preview on hover (src/components/Popups.tsx).
import { createContext, useContext } from "react";

export const PlainTerms = createContext(false);
export const usePlainTerms = () => useContext(PlainTerms);
