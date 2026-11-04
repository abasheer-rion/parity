// Printing a report, which is how it becomes a PDF (DEC-0089): "Save as PDF" opens the
// browser's print dialog, where every browser offers "Save as PDF". While printing, the
// charts draw their last step as still pictures on a light page, and the controls hide.
// The browser's own Print menu does the same through beforeprint and afterprint.
import { createContext, useContext, useEffect, useState } from "react";
import { flushSync } from "react-dom";

export const Printing = createContext(false);
export const usePrintingNow = () => useContext(Printing);

/** True while the page is being printed. */
export function usePrinting(): [boolean, () => void] {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, []);
  const print = () => {
    flushSync(() => setPrinting(true));
    window.print();
    // Browsers that print without afterprint (or tests that stub print) still come back.
    window.setTimeout(() => setPrinting(false), 1000);
  };
  return [printing, print];
}
