// The lesson film player (DEC-0085): Full motion draws the film with video controls; reduced
// motion and Off wait for a press and then play the pre-rendered MP4 with its captions; the
// Motion choice on the player writes the same setting as Settings; the transcript lists
// every line.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { courseById, reelVideo } from "../src/lib/academy";
import { MOTION_KEY, readMotionPref } from "../src/ui/motionCore";
import { ReelPlayer } from "../src/ui/reel/ReelPlayer";
import { plain } from "../src/ui/reel/timeline";

const c = courseById["reading-a-backtest"];
const l = c.lessons[0];

function device(reduced: boolean) {
  const mq = { matches: reduced, media: "(prefers-reduced-motion: reduce)", addEventListener: vi.fn(), removeEventListener: vi.fn() };
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: vi.fn(() => mq) });
}

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.motion;
  delete document.documentElement.dataset.motionOff;
});

afterEach(cleanup);

const player = () => render(<ReelPlayer reel={l.reel!} visual={l.visual} video={reelVideo(c, l)} title={l.title} />);

describe("the lesson film player", () => {
  it("draws the film with play, position, speed, captions and loop at Full motion", () => {
    device(false);
    player();
    expect(screen.getByRole("img", { name: l.reel!.alt })).toBeInTheDocument();
    expect(document.querySelector(".rl-frame svg")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Position in the film" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Speed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CC" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Loop" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Play the film/ })).toBeNull();
  });

  it("waits for a press with reduced motion, then plays the rendered film with captions", () => {
    device(true);
    player();
    expect(screen.getByText(/Your device asks for less motion/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `Play the film: ${l.title}` }));
    const video = document.querySelector("video")!;
    expect(video).not.toBeNull();
    expect(video.getAttribute("src")).toBe(reelVideo(c, l)!.mp4);
    expect(video.hasAttribute("controls")).toBe(true);
    expect(video.querySelector("track[kind=captions]")?.getAttribute("src")).toBe(reelVideo(c, l)!.vtt);
  });

  it("offers Full, Reduced and Off on the player, writing the Motion setting", () => {
    device(true);
    player();
    const group = screen.getByRole("radiogroup", { name: "Motion" });
    expect(screen.getByRole("radio", { name: "Reduced" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Off" }));
    expect(readMotionPref()).toBe("off");
    expect(window.localStorage.getItem(MOTION_KEY)).toBe("off");
    expect(screen.getByText(/Motion is off/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Full" }));
    expect(readMotionPref()).toBe("full");
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("lists every line in the transcript, and a line moves the film there", () => {
    device(false);
    player();
    fireEvent.click(screen.getByRole("button", { name: "Transcript" }));
    for (const b of l.reel!.beats) expect(screen.getAllByText(new RegExp(plain(b.say).slice(0, 24).replace(/[.*+?^${}()|[\]\\$]/g, "\\$&"))).length).toBeGreaterThan(0);
    const lines = document.querySelectorAll(".rl-tline");
    expect(lines.length).toBe(l.reel!.beats.length);
    fireEvent.click(lines[2]);
    expect((screen.getByRole("slider", { name: "Position in the film" }) as HTMLInputElement).valueAsNumber).toBeGreaterThan(0);
  });
});
