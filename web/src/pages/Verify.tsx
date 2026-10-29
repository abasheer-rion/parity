// Parity Verify in the app (REF-0016, INT-0003), /app/#/verify. The checker itself is
// pages/verify/Checker.tsx, shared with the public page at /verify/ (DEC-0081).
import { useCallback, type ReactNode } from "react";
import { Title } from "../components/Shell";
import type { Result } from "../lib/verify/checks";
import { Checker, type FileMeta } from "./verify/Checker";
import { Assistant } from "../assistant/Mount";
import { signalDone } from "../onboarding/done";
import { FirstRunTour } from "../onboarding/FirstRunTour";

export type { FileMeta };

export function Verify({ share }: { share?: (r: Result, file: FileMeta | null) => ReactNode } = {}) {
  // A result on screen is the checklist's "Run your first Verify check" (DEC-0060).
  const done = useCallback(() => signalDone("verify"), []);
  return (
    <>
      <div className="page-head">
        <Title>Verify</Title>
        <p className="page-purpose">
          Upload a trade log, describe a bot, or pick one of our strategies. Verify reports the profit per trade, the worst
          loss, whether the result could be luck given how many things were tried, and signs of tuning to past data or of
          using prices that were not yet known.
        </p>
      </div>
      <Checker share={share} onResult={done} />
      <Assistant place="verify" />
      <FirstRunTour areas={["verify"]} />
    </>
  );
}
