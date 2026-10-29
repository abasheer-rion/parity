// "New version, reload" (DEC-0086): telling a newer deploy from this one, the card, and
// putting typed fields back after the reload.
import { afterEach, describe, expect, it } from "vitest";
import { captureFields, isNewer, restoreFields, showReloadCard } from "../src/lib/siteVersion";

afterEach(() => { document.body.innerHTML = ""; sessionStorage.clear(); });

describe("isNewer", () => {
  it("says yes only for a different, well-formed build", () => {
    expect(isNewer({ build: "abc123" }, "def456")).toBe(true);
    expect(isNewer({ build: "abc123" }, "abc123")).toBe(false);
    expect(isNewer({ build: "abc123" }, "dev")).toBe(false);
    expect(isNewer({ build: "dev" }, "abc123")).toBe(false);
    expect(isNewer({ build: "<script>" }, "abc123")).toBe(false);
    expect(isNewer({ build: 5 }, "abc123")).toBe(false);
    expect(isNewer(null, "abc123")).toBe(false);
    expect(isNewer("abc", "abc123")).toBe(false);
  });
});

describe("fields across a reload", () => {
  it("keeps typed text, choices and selects, never passwords or codes", () => {
    document.body.innerHTML = `
      <input id="q" value="carry"><textarea name="note">two lines</textarea><textarea name="note">second</textarea>
      <input type="checkbox" id="c" checked><select id="s"><option>a</option><option selected>b</option></select>
      <input type="password" id="pw" value="secret"><input id="otp" autocomplete="one-time-code" value="123456">
      <div data-no-restore><input id="skip" value="x"></div>`;
    const saved = captureFields();
    const keys = saved.map((f) => f.key);
    expect(keys).toEqual(["#q", "note@0", "note@1", "#c", "#s"]);
    expect(JSON.stringify(saved)).not.toMatch(/secret|123456/);

    // After the reload the app draws empty fields; they get the values back, with input events.
    document.body.innerHTML = `<input id="q"><textarea name="note"></textarea><textarea name="note"></textarea><input type="checkbox" id="c"><select id="s"><option>a</option><option>b</option></select>`;
    let inputs = 0;
    document.body.addEventListener("input", () => inputs++);
    expect(restoreFields(saved)).toBe(5);
    expect((document.getElementById("q") as HTMLInputElement).value).toBe("carry");
    expect((document.getElementsByName("note")[1] as HTMLTextAreaElement).value).toBe("second");
    expect((document.getElementById("c") as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById("s") as HTMLSelectElement).value).toBe("b");
    expect(inputs).toBeGreaterThanOrEqual(3);
  });
});

describe("the card", () => {
  it("shows once with Reload and Later, and Later remembers this build", () => {
    expect(showReloadCard("b2")).toBe(true);
    expect(showReloadCard("b2")).toBe(false);
    const card = document.querySelector(".pv-card")!;
    expect(card.getAttribute("role")).toBe("status");
    const [reload, later] = Array.from(card.querySelectorAll("button"));
    expect(reload.textContent).toBe("Reload");
    later.click();
    expect(document.querySelector(".pv-card")).toBeNull();
    expect(sessionStorage.getItem("parity.reload.skip")).toBe("b2");
  });
});
