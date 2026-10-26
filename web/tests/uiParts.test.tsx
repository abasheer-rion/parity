// The parts added with the token system (DEC-0057): number formats, page windows, the
// command filter, and the accessible names of the new controls.
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { formatCompact, formatFull, Num } from "../src/ui/number";
import { pageWindow, Pagination, Breadcrumb, Avatar, Tag } from "../src/ui/navigation";
import { matchCommand } from "../src/ui/command";
import { ErrorState, ProgressBar } from "../src/ui/feedback";
import { RadioGroup, Slider } from "../src/ui/inputs";

describe("number formats", () => {
  it("prints the full form with separators and a true minus", () => {
    expect(formatFull(1716746.99, { kind: "money" })).toBe("$1,716,746.99");
    expect(formatFull(-0.0812, { kind: "percent", signed: true })).toBe("−8.1%");
    expect(formatFull(0.1325, { kind: "percent", signed: true })).toBe("+13.3%");
    expect(formatFull(26317)).toBe("26,317");
    expect(formatFull(null)).toBe("n/a");
    expect(formatFull(Number.NaN)).toBe("n/a");
  });
  it("prints the compact form with three significant figures", () => {
    expect(formatCompact(1716746.99, { kind: "money" })).toBe("$1.72M");
    expect(formatCompact(-45612)).toBe("−45.6K");
    expect(formatCompact(999)).toBe("999");
    expect(formatCompact(2.5e12)).toBe("2.5T");
  });
  it("keeps the full value for screen readers when the compact form shows", () => {
    render(<Num value={1716746.99} kind="money" mode="compact" />);
    expect(screen.getByText("$1,716,746.99")).toBeInTheDocument();
    expect(screen.getByText("$1.72M")).toHaveAttribute("aria-hidden");
  });
  it("colours by sign and still prints the sign", () => {
    const { container } = render(<Num value={-0.05} kind="percent" tone="sign" mode="full" />);
    expect(container.querySelector(".ui-num-negative")?.textContent).toContain("−5.0%");
  });
});

describe("navigation", () => {
  it("windows long page lists around the current page", () => {
    expect(pageWindow(4, 12)).toEqual([1, "gap", 3, 4, 5, "gap", 12]);
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
  });
  it("labels pages and marks the current one", () => {
    const go = vi.fn();
    render(<Pagination page={2} pages={5} onChange={go} />);
    expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(go).toHaveBeenCalledWith(3);
    expect(screen.getByRole("button", { name: "Previous page" })).not.toBeDisabled();
  });
  it("marks the last crumb as the current page", () => {
    render(<Breadcrumb items={[{ label: "Research", href: "#/" }, { label: "Docs" }]} />);
    expect(screen.getByText("Docs")).toHaveAttribute("aria-current", "page");
  });
  it("names avatars and tag remove buttons", () => {
    render(<><Avatar name="Amanda Lee" /><Tag onRemove={() => {}}>BTC</Tag></>);
    expect(screen.getByRole("img", { name: "Amanda Lee" })).toHaveTextContent("AL");
    expect(screen.getByRole("button", { name: "Remove BTC" })).toBeInTheDocument();
  });
});

describe("command filter", () => {
  const c = { id: "v", label: "Open Verify", group: "Go to", keywords: "check trades", run: () => {} };
  it("needs every word and prefers word starts", () => {
    expect(matchCommand(c, "verify")).toBeGreaterThan(0);
    expect(matchCommand(c, "open trades")).toBeGreaterThan(0);
    expect(matchCommand(c, "trade xyz")).toBe(0);
    expect(matchCommand(c, "open")).toBeGreaterThan(matchCommand(c, "pen"));
  });
});

describe("feedback and inputs", () => {
  it("error state offers Retry", () => {
    const retry = vi.fn();
    render(<ErrorState title="Prices did not load" onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Prices did not load");
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    expect(retry).toHaveBeenCalled();
  });
  it("progress reports its value", () => {
    render(<ProgressBar label="Checking" value={0.42} />);
    expect(screen.getByRole("progressbar", { name: "Checking" })).toHaveAttribute("aria-valuenow", "42");
  });
  it("radio and slider are labelled controls", () => {
    const set = vi.fn();
    render(<><RadioGroup name="s" label="Side" value="buy" onChange={set} options={[["buy", "Buy"], ["sell", "Sell"]]} /><Slider label="Risk" value={1} onChange={() => {}} /></>);
    fireEvent.click(screen.getByRole("radio", { name: "Sell" }));
    expect(set).toHaveBeenCalledWith("sell");
    expect(screen.getByRole("slider", { name: /Risk/ })).toBeInTheDocument();
  });
});
