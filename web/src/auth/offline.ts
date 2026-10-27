// The desktop app's bundled copy (app://parity, DEC-0048), started offline, cannot renew an
// expired session. When the app's own session cookie says who is signed in, the copy shows
// its pages to that person until the live site is back (DEC-0072). Elsewhere this is null.
import { desktop, type DesktopUser } from "../desktop/bridge";

export async function offlineUser(): Promise<DesktopUser | null> {
  if (!desktop?.savedUser || typeof window === "undefined" || window.location.protocol !== "app:") return null;
  try { return (await desktop.savedUser()) ?? null; } catch { return null; }
}
