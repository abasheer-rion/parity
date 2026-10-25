// Add a crypto wallet, read only (DEC-0057). Two ways: sign a message in the wallet app
// (Sign-In With Ethereum, EIP-4361, or the same message on Solana), which the server checks
// before marking the wallet verified; or type the public address, saved as not verified.
// Parity never asks for a seed phrase or private key, says so at the top, and refuses
// anything that looks like one before it leaves the box.
import { useState } from "react";
import { Badge, Button, Dialog, Segmented, toast } from "../ui";
import { table, useRows, type Row } from "../lib/userStore";
import { track } from "../lib/analytics";
import { CHAINS, checkAddress, looksSecret, shortAddress, toChecksumAddress, type Chain } from "../lib/wallet/address";
import { buildMessage, newNonce } from "../lib/wallet/siwe";
import { signalDone } from "./done";

export interface WalletRow extends Row { chain: Chain; address: string; verified_at: string | null }
export const walletsTable = table<WalletRow>("crypto_wallets");

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
type SolKey = { toString(): string };
type Sol = { connect: () => Promise<{ publicKey?: SolKey } | undefined>; publicKey?: SolKey; signMessage: (m: Uint8Array, enc?: string) => Promise<Uint8Array | { signature: Uint8Array }> };

function providers(): { eth: Eth | null; sol: Sol | null } {
  const w = window as unknown as { ethereum?: Eth; solana?: Sol; phantom?: { solana?: Sol }; solflare?: Sol };
  return { eth: w.ethereum ?? null, sol: w.phantom?.solana ?? w.solana ?? w.solflare ?? null };
}

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const toBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));

async function session() {
  const { supabase } = await import("../auth/client");
  return (await supabase.auth.getSession()).data.session;
}

export function WalletDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [chain, setChain] = useState<Chain>("ethereum");
  const [typed, setTyped] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<"sign" | "add" | null>(null);
  const wallets = useRows(walletsTable, "crypto_wallets");
  const p = providers();
  const provider = chain === "ethereum" ? p.eth : p.sol;
  const secret = looksSecret(typed);

  const reset = () => { setProblem(null); setNote(null); };

  async function addTyped() {
    reset();
    const c = checkAddress(chain, typed);
    if (!c.ok) { setProblem(c.problem); if (looksSecret(typed)) setTyped(""); return; }
    setBusy("add");
    try {
      await walletsTable.insert({ chain, address: c.address, verified_at: null });
      setTyped("");
      setNote("Saved as not verified. Sign with your wallet app to verify it.");
      track("wallet_added", { chain, verified: false });
      signalDone("wallet");
    } catch (e) {
      setProblem(/duplicate|unique/i.test(String(e)) ? "You already added this wallet." : /at most 10/.test(String(e)) ? "You can add up to 10 wallets." : "Could not save the address. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function sign() {
    reset();
    if (!provider) return;
    setBusy("sign");
    try {
      const s = await session();
      if (!s) { setProblem("Sign in first."); return; }
      let address = "", signature = "";
      const base = { chain, domain: window.location.host, origin: window.location.origin, userId: s.user.id, nonce: newNonce() };
      let message = "";
      if (chain === "ethereum") {
        const accounts = (await (provider as Eth).request({ method: "eth_requestAccounts" })) as string[];
        if (!accounts?.[0]) { setProblem("Your wallet app did not share an address."); return; }
        address = toChecksumAddress(accounts[0]);
        message = buildMessage({ ...base, address });
        signature = String(await (provider as Eth).request({ method: "personal_sign", params: [`0x${toHex(new TextEncoder().encode(message))}`, accounts[0]] }));
      } else {
        const sol = provider as Sol;
        const res = await sol.connect();
        const key = res?.publicKey ?? sol.publicKey;
        if (!key) { setProblem("Your wallet app did not share an address."); return; }
        address = key.toString();
        message = buildMessage({ ...base, address });
        const out = await sol.signMessage(new TextEncoder().encode(message), "utf8");
        signature = toBase64(out instanceof Uint8Array ? out : out.signature);
      }
      const r = await fetch("/api/wallet/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.access_token}` },
        body: JSON.stringify({ chain, address, message, signature }),
      });
      const body = (await r.json().catch(() => ({}))) as { error?: string };
      if (r.status === 503) { setProblem("Signing to verify is not switched on yet. You can add the address only for now."); return; }
      if (!r.ok) { setProblem(body.error ?? "Could not verify the wallet."); return; }
      wallets.reload();
      setNote("Verified. Parity saved the public address and the time.");
      track("wallet_added", { chain, verified: true });
      signalDone("wallet");
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e);
      setProblem(/reject|denied|cancel/i.test(msg) ? "You cancelled in your wallet app. Nothing was saved." : "Your wallet app could not sign the message.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(w: WalletRow) {
    try { await walletsTable.remove(w.id); toast("Wallet removed"); } catch { toast("Could not remove the wallet", { tone: "bad" }); }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add a crypto wallet, read only" width={520}>
      <div className="wal-warn" role="note">
        <span aria-hidden>!</span>
        <span><strong>Parity never asks for your seed phrase, recovery words or private key.</strong> Anyone who asks for them can take your coins. We keep only the public address, the chain and when you proved the wallet is yours.</span>
      </div>
      <Segmented<Chain> label="Chain" value={chain} onChange={(c) => { setChain(c); reset(); }} options={CHAINS.map((c) => [c.id, c.label])} size="sm" />
      <p className="muted small" style={{ margin: "6px 0 14px" }}>{CHAINS.find((c) => c.id === chain)?.hint}</p>

      <section className="wal-section">
        <h3>Prove it is yours</h3>
        <p>Your wallet app shows a message to sign. Signing moves no money and gives Parity no access to it. Later this lets Parity show your holdings and check trades on chain.</p>
        {provider
          ? <Button variant="primary" onClick={() => void sign()} loading={busy === "sign"}>Sign with wallet app</Button>
          : <p>No {chain === "ethereum" ? "Ethereum" : "Solana"} wallet app found in this browser. Install one such as {chain === "ethereum" ? "MetaMask" : "Phantom"}, or add the address only.</p>}
      </section>

      <section className="wal-section">
        <h3>Or add the address only</h3>
        <p>Shown as not verified until you sign.</p>
        <div className="wal-row">
          <input className="ui-input" aria-label="Public wallet address" placeholder={chain === "ethereum" ? "0x..." : "Solana address"} value={typed}
            autoComplete="off" spellCheck={false} onChange={(e) => { setTyped(e.target.value); reset(); }} aria-invalid={secret || undefined} />
          <Button onClick={() => void addTyped()} loading={busy === "add"} disabled={!typed.trim()}>Add address</Button>
        </div>
        {secret && <p className="wal-problem" role="alert">That looks like a seed phrase or private key. Never share it with anyone, Parity included. Clear the box and paste the public address instead.</p>}
      </section>
      {problem && !secret && <p className="wal-problem" role="alert">{problem}</p>}
      {note && <p className="wal-ok" role="status">{note}</p>}

      {wallets.rows.length > 0 && (
        <section className="wal-section">
          <h3>Your wallets</h3>
          <ul className="wal-list">
            {wallets.rows.map((w) => (
              <li key={w.id}>
                <code title={w.address}>{shortAddress(w.address)}</code>
                <span className="muted small">{CHAINS.find((c) => c.id === w.chain)?.label}</span>
                <span className="grow" />
                {w.verified_at ? <Badge tone="good">Verified</Badge> : <Badge>Not verified</Badge>}
                <Button size="sm" variant="tertiary" onClick={() => void remove(w)}>Remove</Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Dialog>
  );
}
