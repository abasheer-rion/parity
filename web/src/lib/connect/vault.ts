// Keeping a read-only credential for "keep in sync" (DEC-0091). Off by default: a credential
// is used once and dropped. Only when the person ticks "keep in sync" is it stored, sealed:
//
//   BROKER_CREDENTIAL_KEY   a Cloudflare secret, 32 random bytes as base64url. Never in the
//                           database, never in the browser.
//   data key                one per person, 32 random bytes, stored in broker_data_keys only
//                           in sealed form (AES-GCM under a key derived from the secret, tied
//                           to the person's id).
//   sealed credential       AES-GCM under the person's data key, tied to the person's id, the
//                           connection's id and the venue, so a sealed value copied to another
//                           row, person or venue does not open.
//
// The database holds only sealed bytes, so a leak of the database alone opens nothing.
// Revoking a connection deletes its sealed credential. Rotating the secret: set the new one,
// and connections sealed under the old key id ask to be connected again.
import { ab, fromB64url, fromUtf8, hkdf, randomBytes, sha256, toB64url, utf8 } from "./bytes";

export class VaultError extends Error {}

export interface Vault {
  /** A short id for the secret in use, stored next to each sealed value. */
  keyId: string;
  /** A new sealed data key for a person who has none. */
  newDataKey(userId: string): Promise<string>;
  seal(sealedDataKey: string, userId: string, scope: string, value: unknown): Promise<string>;
  open<T>(sealedDataKey: string, userId: string, scope: string, sealed: string): Promise<T>;
}

const SEALED = /^v1\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{22,})$/;

async function aesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", ab(raw), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encrypt(key: CryptoKey, plain: Uint8Array, aad: string): Promise<string> {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: ab(iv), additionalData: ab(utf8(aad)) }, key, ab(plain)));
  return `v1.${toB64url(iv)}.${toB64url(ct)}`;
}

async function decrypt(key: CryptoKey, sealed: string, aad: string): Promise<Uint8Array> {
  const m = sealed.match(SEALED);
  if (!m) throw new VaultError("The stored value is not in a form we can open.");
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: ab(fromB64url(m[1])), additionalData: ab(utf8(aad)) }, key, ab(fromB64url(m[2]))));
  } catch {
    throw new VaultError("The stored value could not be opened.");
  }
}

/** The vault for a secret, or null when the secret is missing or not 32 bytes of base64url. */
export async function vaultFrom(secret: string | undefined): Promise<Vault | null> {
  if (!secret) return null;
  let raw: Uint8Array;
  try { raw = fromB64url(secret.trim()); } catch { return null; }
  if (raw.length !== 32) return null;
  const kek = await aesKey(await hkdf(raw, "parity broker data key wrap v1"));
  const keyId = toB64url(await sha256(await hkdf(raw, "parity broker key id v1"))).slice(0, 8);
  const dekAad = (userId: string) => `parity dek v1:${keyId}:${userId}`;
  const valueAad = (userId: string, scope: string) => `parity credential v1:${userId}:${scope}`;
  const openDek = async (sealedDataKey: string, userId: string) => aesKey(await decrypt(kek, sealedDataKey, dekAad(userId)));
  return {
    keyId,
    newDataKey: (userId) => encrypt(kek, randomBytes(32), dekAad(userId)),
    seal: async (sealedDataKey, userId, scope, value) => encrypt(await openDek(sealedDataKey, userId), utf8(JSON.stringify(value)), valueAad(userId, scope)),
    open: async <T>(sealedDataKey: string, userId: string, scope: string, sealed: string) => {
      const plain = await decrypt(await openDek(sealedDataKey, userId), sealed, valueAad(userId, scope));
      return JSON.parse(fromUtf8(plain)) as T;
    },
  };
}
