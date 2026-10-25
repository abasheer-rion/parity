// Entry for /connect/ and /oauth/consent/ (DEC-0051).
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../legal/notice";
import { ConnectApp } from "./ConnectApp";
import "./connect.css";

createRoot(document.getElementById("root")!).render(<StrictMode><ConnectApp /></StrictMode>);
