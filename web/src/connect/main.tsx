// Entry for /connect/ and /oauth/consent/ (DEC-0051).
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../legal/notice";
import "../lib/scrollRegions";
import "../site/viewTransitions";
import { ConnectApp } from "./ConnectApp";
import "./connect.css";
import "../lib/a11y/scrollRegions";

createRoot(document.getElementById("root")!).render(<StrictMode><ConnectApp /></StrictMode>);
