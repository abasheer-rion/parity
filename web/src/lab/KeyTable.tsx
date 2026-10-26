// The Workbench's keys, in the Keys dialog and in Settings (DEC-0043).
import { KEYS } from "./state";

export function KeyTable() {
  return (
    <table className="lb-keys" aria-label="Keyboard shortcuts">
      <tbody>{KEYS.map(([k, w]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{w}</td></tr>)}</tbody>
    </table>
  );
}
