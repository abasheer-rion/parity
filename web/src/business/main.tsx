// Entry for the React pages for firms (DEC-0087): the batch screen (/business/screen/) and the
// synthetic sample report (/business/prop-firms/sample/). The page says which by data-app.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./pilot";
import { SampleApp } from "./SampleApp";
import { ScreenApp } from "./ScreenApp";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<StrictMode>{root.dataset.app === "sample" ? <SampleApp /> : <ScreenApp />}</StrictMode>);
}
