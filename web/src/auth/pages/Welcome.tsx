// The welcome after a new account is confirmed (DEC-0044): one screen that says the account is
// ready, then on to next. The questions it used to ask moved into the app's first-run intro
// (DEC-0077), which opens on Home, saves the answers with the account and ends on a real
// Verify result.
import { DEFAULT_NEXT } from "../redirect";
import { Submit } from "../fields";
import { Screen } from "../flow";
import { useFlow } from "../flow";
import { go } from "../nav";

export function Welcome() {
  const { next } = useFlow();
  const app = next === DEFAULT_NEXT;
  return (
    <Screen id="welcome-about" title="Welcome to Parity" lead="Your account is ready.">
      <div className="pa-form">
        <p className="pa-copy">
          Parity checks trading strategies and bots. Upload a trade log, describe a bot or pick a strategy, and Parity says
          whether the record holds up, counting every setting that was tried to get it.
          {app && " The app asks three short questions first, then shows a real check."}
        </p>
        <Submit type="button" onClick={() => go(next)} autoFocus>{app ? "Go to the app" : "Continue where you were"}</Submit>
      </div>
    </Screen>
  );
}
