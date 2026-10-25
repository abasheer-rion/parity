// Parity Academy as its own app (DEC-0042): old product app links land on the same course
// and lesson, lesson links into Parity reach the right app, and progress is saved per
// lesson, keeps the best score, remembers the last lesson opened and takes over the old
// browser-only progress once.
import { act, render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { courses } from "../src/lib/academy";
import { academyHashFor, academyUrl, appLink } from "../src/lib/space";
import { setLocalStore } from "../src/lib/userStore";
import { legacyDone, ProgressProvider, progressTable, useProgress, type Progress } from "../src/academy/progress";

describe("old #/academy links", () => {
  it.each([
    ["#/academy", ""],
    ["#/academy/luck-vs-skill", "luck-vs-skill"],
    ["#/academy/luck-vs-skill/noise", "luck-vs-skill/noise"],
    ["#/academy/luck-vs-skill/noise/extra?x=1", "luck-vs-skill/noise"],
    ["#/academy/<script>", ""],
    ["#/strategies", ""],
  ])("%s opens %s", (from, to) => {
    expect(academyHashFor(from)).toBe(to);
  });

  it("opens academy.endyland.com on endyland.com and /academy/ elsewhere", () => {
    const onSite = /(^|\.)endyland\.com$/.test(window.location.hostname);
    expect(academyUrl()).toBe(onSite ? "https://academy.endyland.com/" : "/academy/");
    expect(academyUrl("luck-vs-skill/noise")).toBe(onSite ? "https://academy.endyland.com/#/luck-vs-skill/noise" : "/academy/#/luck-vs-skill/noise");
  });
});

describe("appLink", () => {
  it("sends each page to its own app", () => {
    const onSite = /(^|\.)endyland\.com$/.test(window.location.hostname);
    const main = onSite ? "https://parity.endyland.com" : "";
    const sub = (name: string, rest: string) => (onSite ? `https://${name}.endyland.com/${rest}` : `/${name}/${rest}`);
    expect(appLink("product", "#/strategies")).toBe(`${main}/app/#/strategies`);
    expect(appLink("both", "#/learn/cagr")).toBe(`${main}/app/#/learn/cagr`);
    expect(appLink("research", "#/doc/DEC-0026")).toBe(`${main}/research/#/doc/DEC-0026`);
    expect(appLink("product", "#/trade")).toBe(sub("trade", "#/chart"));
    expect(appLink("research", "#/sim")).toBe(sub("sim", ""));
    expect(appLink("product", "#/academy/luck-vs-skill")).toBe(sub("academy", "#/luck-vs-skill"));
  });
});

describe("progress", () => {
  let p: Progress;
  function Probe() { p = useProgress(); return null; }
  const mount = async () => {
    render(createElement(ProgressProvider, null, createElement(Probe)));
    await waitFor(() => expect(p.loading).toBe(false));
  };
  const c = courses[0], l0 = c.lessons[0], l1 = c.lessons[1];

  beforeEach(async () => {
    setLocalStore(true);
    localStorage.clear();
    await progressTable.removeWhere({});
  });

  it("starts empty, with the first lesson of each course next", async () => {
    await mount();
    expect(p.doneCount).toBe(0);
    expect(p.resume).toBeNull();
    expect(p.nextIn(c).id).toBe(l0.id);
  });

  it("marks a lesson done, keeps the best score and moves next on", async () => {
    await mount();
    act(() => p.finish(c.id, l0.id, 2, 2));
    await waitFor(() => expect(p.isDone(c.id, l0.id)).toBe(true));
    act(() => p.finish(c.id, l0.id, 1, 2));
    await waitFor(async () => expect((await progressTable.list())[0]?.score).toBe(2));
    expect(p.score(c.id, l0.id)).toEqual({ score: 2, total: 2 });
    expect(p.courseDone(c)).toBe(1);
    expect(p.nextIn(c).id).toBe(l1.id);
    expect(await progressTable.list()).toHaveLength(1);
  });

  it("remembers the lesson opened last, and the next visit continues there", async () => {
    await mount();
    act(() => p.opened(c.id, l0.id));
    await waitFor(() => expect(p.resume?.lesson.id).toBe(l0.id));
    await new Promise((r) => setTimeout(r, 5));
    act(() => p.opened(c.id, l1.id));
    await waitFor(() => expect(p.resume?.lesson.id).toBe(l1.id));
    expect(p.isDone(c.id, l1.id)).toBe(false);
    // A fresh load reads the same rows back.
    await mount();
    expect(p.resume?.lesson.id).toBe(l1.id);
  });

  it("ignores lessons that do not exist", async () => {
    await mount();
    act(() => { p.opened("nope", "x"); p.finish(c.id, "nope", 1, 1); });
    await new Promise((r) => setTimeout(r, 20));
    expect(await progressTable.list()).toHaveLength(0);
  });

  it("copies the old browser progress into the account once", async () => {
    localStorage.setItem("parity.academy.v1", JSON.stringify({ done: { [`${c.id}/${l0.id}`]: 2, "gone/lesson": 1 } }));
    expect(legacyDone()).toEqual([{ course: c.id, lesson: l0.id, score: 2 }]);
    await mount();
    expect(p.isDone(c.id, l0.id)).toBe(true);
    expect(p.doneCount).toBe(1);
    expect(localStorage.getItem("parity.academy.v1")).toBeNull();
  });

  it("clears every lesson", async () => {
    await mount();
    act(() => { p.finish(c.id, l0.id, 1, 2); p.finish(courses[1].id, courses[1].lessons[0].id, 2, 2); });
    await waitFor(async () => expect(await progressTable.list()).toHaveLength(2));
    await act(() => p.clear());
    expect(p.doneCount).toBe(0);
    expect(await progressTable.list()).toHaveLength(0);
  });
});
