// Small controls shared by the replay tabs.
import { Select } from "../../../ui";
import { WINDOWS } from "./data";

export function WindowSelect({ value, onChange, crises = true }: { value: string; onChange: (v: string) => void; crises?: boolean }) {
  const list = crises ? WINDOWS : WINDOWS.slice(0, 5);
  return <Select<string> label="Window" value={value} onChange={onChange} options={list.map((w) => [w.id, w.label] as [string, string])} />;
}
