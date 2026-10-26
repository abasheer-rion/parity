// Where Workbench, Verify and Trade place the assistant (DEC-0051). Renders nothing while the
// flag is off, and loads the panel's code only when it is on.
import { lazy, Suspense } from "react";
import { assistantEnabled } from "./keys";

const Panel = lazy(() => import("./AssistantPanel"));

export function Assistant({ place }: { place: "workbench" | "verify" | "trade" }) {
  if (!assistantEnabled()) return null;
  return <Suspense fallback={null}><Panel place={place} /></Suspense>;
}
