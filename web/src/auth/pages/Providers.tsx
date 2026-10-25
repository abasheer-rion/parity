// "Continue with Google / GitHub / passkey" buttons. Only configured options show
// (config.ts). Nothing renders when none are on.
import { desktop, DESKTOP_SCHEME } from "../../desktop/bridge";
import { explain, supabase } from "../client";
import { ENABLED_PROVIDERS, PASSKEYS_ENABLED, ROUTES, type ProviderId } from "../config";
import { Submit, useSubmit } from "../fields";
import { useFlow } from "../flow";
import { go } from "../nav";
import { withNext } from "../redirect";
import { continueTo } from "../session";

export function ProviderButtons({ onError }: { onError: (msg: string | null) => void }) {
  const { next } = useFlow();
  const { busy, run } = useSubmit();
  if (!ENABLED_PROVIDERS.length && !PASSKEYS_ENABLED) return null;

  const oauth = (provider: ProviderId) => run(async () => {
    // Come back to /login/ on this host, which is public, so the browser can finish
    // signing in (and ask for an authenticator code) before it opens the app. `next`
    // is already checked by safeNext.
    // In the desktop app (DEC-0041) the provider's page opens in the browser and comes
    // back to parity://login/, which the app turns into its own /login/ page.
    if (desktop) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${DESKTOP_SCHEME}://${withNext(ROUTES.login, next).replace(/^\//, "")}`, skipBrowserRedirect: true },
      });
      if (data?.url) desktop.openExternal(data.url);
      onError(explain(error));
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${withNext(ROUTES.login, next)}` },
    });
    onError(explain(error));
  });

  const passkey = run(async () => {
    const { error } = await supabase.auth.signInWithPasskey();
    if (error) { onError(explain(error)); return; }
    if ((await continueTo(next, go)) === "second-step") go(withNext(`${ROUTES.login}?mfa=1`, next));
  });

  return (
    <>
      <div className="pa-providers">
        {ENABLED_PROVIDERS.map((p) => (
          <Submit key={p.id} type="button" primary={false} busy={busy} onClick={() => void oauth(p.id)()}>Continue with {p.label}</Submit>
        ))}
        {PASSKEYS_ENABLED && <Submit type="button" primary={false} busy={busy} onClick={() => void passkey()}>Use a passkey</Submit>}
      </div>
      <div className="pa-or" aria-hidden="true"><span>or</span></div>
    </>
  );
}
