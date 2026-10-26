// The Motion control for each app's settings page (REF-0023): Match my device, Full or
// Reduced. The choice is kept in this browser and applies to every Parity app here.
import { Segmented } from "./inputs";
import { useMotionLevel, useMotionPref, writeMotionPref, type MotionPref } from "./motionPref";

export const MOTION_OPTIONS: [MotionPref, string][] = [["system", "Match my device"], ["full", "Full"], ["reduced", "Reduced"]];

/** The three-way control on its own, for a settings row an app lays out itself. */
export function MotionControl({ size = "sm" }: { size?: "sm" | "md" }) {
  const pref = useMotionPref();
  return <span className="ui-motion-ctl"><Segmented size={size} label="Motion" value={pref} onChange={writeMotionPref} options={MOTION_OPTIONS} /></span>;
}

/** One line saying what plays now, for under the control. */
export function useMotionHelp(): string {
  const pref = useMotionPref();
  const level = useMotionLevel();
  if (pref === "full") return "Every animation plays, even if your device asks for less motion.";
  if (pref === "reduced") return "Things fade in and out, but nothing slides, grows or counts.";
  return level === "reduced"
    ? "Your device asks for less motion, so things fade but nothing slides. Choose Full to see every animation."
    : "Every animation plays. If your device asks for less motion, things will fade but not slide.";
}

/** A short description under the control. */
export function MotionHelp({ className = "" }: { className?: string }) {
  return <span className={className}>{useMotionHelp()}</span>;
}
