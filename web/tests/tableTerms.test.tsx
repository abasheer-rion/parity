// A glossary term in a sortable column header used to be a link inside the sort button:
// clicking the header opened the glossary instead of sorting.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Learn's docs module reads a build-time virtual module; the term link does not need it.
vi.mock("../src/lib/docs", () => ({ useDocs: () => null }));
window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
import { Term } from "../src/pages/Learn";
import { DataTable, type Column } from "../src/ui";

type Row = { name: string; cagr: number };
const rows: Row[] = [{ name: "a", cagr: 0.01 }, { name: "b", cagr: 0.05 }];
const columns: Column<Row>[] = [
  { key: "name", header: "Name", align: "left", render: (r) => r.name },
  { key: "cagr", header: <Term id="cagr">CAGR</Term>, sort: (r) => r.cagr, render: (r) => String(r.cagr) },
];

afterEach(cleanup);

describe("sortable headers with glossary terms", () => {
  it("renders the term as text inside the sort button, not a link", () => {
    render(<DataTable rows={rows} columns={columns} rowKey={(r) => r.name} />);
    const term = screen.getByText("CAGR");
    expect(term.closest("a")).toBeNull();
    expect(term.closest("button")).not.toBeNull();
    expect(term.getAttribute("data-term")).toBe("cagr");
  });

  it("sorts when the term is clicked", () => {
    render(<DataTable rows={rows} columns={columns} rowKey={(r) => r.name} />);
    fireEvent.click(screen.getByText("CAGR"));
    expect(screen.getByText("CAGR").closest("th")?.getAttribute("aria-sort")).toMatch(/ascending|descending/);
  });

  it("keeps terms as links outside a header", () => {
    render(<p><Term id="cagr">CAGR</Term></p>);
    expect(screen.getByText("CAGR").closest("a")?.getAttribute("href")).toBe("#/learn/cagr");
  });
});
