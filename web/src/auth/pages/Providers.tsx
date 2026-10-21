// "Continue with Google / GitHub / passkey" buttons. Only configured options show
// (config.ts). Nothing renders when none are on.
import { Button } from "../../ui";
import { explain, supabase } from "../client";
import { ENABLED_PROVIDERS, PASSKEYS_ENABLED, ROUTES, type ProviderId } from "../config";
import { go, useSubmit } from "../form";

export function ProviderButtons({ onError }: { onError: (msg: string | null) => void }) {
  const { busy, run } = useSubmit();
  if (!ENABLED_PROVIDERS.length && !PASSKEYS_ENABLED) return null;

  const oauth = (provider: ProviderId) => run(async () => {
    // Come back to /login/, which is public, so the browser can finish signing in
    // before it asks for the protected app.
    const next = new URLSearchParams(window.location.search).get("next") ?? ROUTES.app;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${ROUTES.login}?next=${encodeURIComponent(next)}` },
    });
    onError(explain(error));
  });

  const passkey = run(async () => {
    const { error } = await supabase.auth.signInWithPasskey();
    if (error) { onError(explain(error)); return; }
    go(ROUTES.app);
  });

  return (
    <>
      <div className="auth-providers">
        {ENABLED_PROVIDERS.map((p) => (
          <Button key={p.id} size="lg" full disabled={busy} onClick={() => void oauth(p.id)()}>Continue with {p.label}</Button>
        ))}
        {PASSKEYS_ENABLED && <Button size="lg" full disabled={busy} icon="user" onClick={() => void passkey()}>Use a passkey</Button>}
      </div>
      <div className="auth-or"><span>or</span></div>
    </>
  );
}
