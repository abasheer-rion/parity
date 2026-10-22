// "Continue with Google / GitHub / passkey" buttons. Only configured options show
// (config.ts). Nothing renders when none are on.
import { Button } from "../../ui";
import { explain, supabase } from "../client";
import { ENABLED_PROVIDERS, PASSKEYS_ENABLED, ROUTES, type ProviderId } from "../config";
import { go, useSubmit } from "../form";
import { withNext } from "../redirect";
import { continueTo } from "../session";

export function ProviderButtons({ onError, next }: { onError: (msg: string | null) => void; next: string }) {
  const { busy, run } = useSubmit();
  if (!ENABLED_PROVIDERS.length && !PASSKEYS_ENABLED) return null;

  const oauth = (provider: ProviderId) => run(async () => {
    // Come back to /login/ on this host, which is public, so the browser can finish
    // signing in (and ask for an authenticator code) before it opens the app. `next`
    // is already checked by safeNext.
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
      <div className="auth-providers">
        {ENABLED_PROVIDERS.map((p) => (
          <Button key={p.id} size="lg" full disabled={busy} onClick={() => void oauth(p.id)()}>Continue with {p.label}</Button>
        ))}
        {PASSKEYS_ENABLED && <Button size="lg" full disabled={busy} icon="user" onClick={() => void passkey()}>Use a passkey</Button>}
      </div>
      <div className="auth-or" aria-hidden="true"><span>or</span></div>
    </>
  );
}
