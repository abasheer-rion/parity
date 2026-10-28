// The motion reel player (DEC-0083): a lesson's film, played like a video. It plays on its
// own when it scrolls into view (Full motion and the lesson autoplay setting on), loops,
// and pauses when it leaves the screen or the tab is hidden. Controls: play and pause, a
// scrubber with chapters, the time, speed, captions, loop and the Motion choice.
//
// Reduced motion and Off: nothing plays by itself. The player shows a still frame with a
// play button, and pressing it plays the pre-rendered MP4 of the same film with the
// browser's own controls and captions (user-started playback with a pause control, WCAG
// 2.2.2 and 2.3.3). Without a rendered file it plays the live film instead, also only
// when asked.
//
// Text alternatives (WCAG 1.1.1, 1.2.1): the figure's label says what the film shows, the
// transcript lists every line with its time, and "Show the numbers" opens the table.
import DOMPurify from "dompurify";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "../buttons";
import { Icon } from "../icons";
import { Segmented } from "../inputs";
import { useMotionLevel, useMotionPref, writeMotionPref, type MotionPref } from "../motionPref";
import { signatureTable, type SigVisual } from "../signature/scenes";
import { SignatureTable } from "../signature/Player";
import { renderReel, REEL_SIZES, type ReelSize } from "./render";
import { beatAt, chapterAt, clock, pageAt, plain, plan, type Reel } from "./timeline";
import "./reel.css";

/** Below this width the player draws the square layout, so text stays readable on a phone. */
const SQUARE_BELOW = 520;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const KEY = "parity.reel";

interface Prefs { captions: boolean; loop: boolean; rate: number }

function readPrefs(): Prefs {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    return { captions: v.captions !== false, loop: v.loop !== false, rate: SPEEDS.includes(v.rate) ? v.rate : 1 };
  } catch {
    return { captions: true, loop: true, rate: 1 };
  }
}

function writePrefs(p: Prefs) {
  try { window.localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked: the choice lasts this visit */ }
}

/** Our own SVG markup for one frame. It still goes through DOMPurify, with the blur filters allowed. */
function paint(el: HTMLElement, w: number, h: number, inner: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" class="rl-svg" aria-hidden="true" focusable="false">${inner}</svg>`;
  el.replaceChildren(DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, RETURN_DOM_FRAGMENT: true }));
}

/** A still frame of a reel (posters, the storyboard). */
export function ReelFrame({ reel, visual, t, size = "wide", id }: { reel: Reel; visual: SigVisual; t?: number; size?: ReelSize; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const P = useMemo(() => plan(reel), [reel]);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  useLayoutEffect(() => {
    if (!ref.current) return;
    const c = REEL_SIZES[size];
    paint(ref.current, c.w, c.h, renderReel(reel, visual, P, t ?? P.poster, { size, id: id ?? `rf${uid}` }));
  }, [reel, visual, P, t, size, id, uid]);
  return <div ref={ref} className="rl-frame" data-size={size} />;
}

export interface ReelPlayerProps {
  reel: Reel;
  visual: SigVisual;
  /** The pre-rendered film and its captions, for reduced motion (and to share). */
  video?: { mp4: string; vtt?: string };
  /** Play by itself when it scrolls into view, with Full motion (default true). */
  autoPlay?: boolean;
  /** What the film is about, for the controls' labels. */
  title: string;
  className?: string;
}

export function ReelPlayer({ reel, visual, video, autoPlay = true, title, className = "" }: ReelPlayerProps) {
  const pref = useMotionPref();
  const level = useMotionLevel();
  const live = level === "full";
  const P = useMemo(() => plan(reel), [reel]);
  const [prefs, setPrefsState] = useState<Prefs>(readPrefs);
  const setPrefs = (patch: Partial<Prefs>) => setPrefsState((p) => { const n = { ...p, ...patch }; writePrefs(n); return n; });
  const [t, setT] = useState(live ? 0 : P.poster);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false); // reduced motion: the person pressed play
  const [transcript, setTranscript] = useState(false);
  const [table, setTable] = useState(false);
  const [size, setSize] = useState<ReelSize>("wide");
  const box = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const tRef = useRef(t);
  const raf = useRef(0);
  const visible = useRef(false);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ids = { tr: `${uid}-tr`, tb: `${uid}-tb` };
  const data = useMemo(() => signatureTable(visual), [visual]);

  // The layout follows the width, before the first paint.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const pick = () => setSize(el.clientWidth < SQUARE_BELOW ? "square" : "wide");
    pick();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(pick);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Draw the frame for t. Only the picture changes, so React never re-renders 60 times a second.
  const draw = useCallback((at: number) => {
    const el = stage.current;
    if (!el) return;
    const c = REEL_SIZES[size];
    paint(el, c.w, c.h, renderReel(reel, visual, P, at, { size, id: `rl${uid}` }));
  }, [reel, visual, P, size, uid]);
  const showVideo = !live && started && !!video;
  useLayoutEffect(() => { draw(tRef.current); }, [draw, showVideo]);

  const seek = useCallback((to: number) => {
    const v = Math.max(0, Math.min(P.seconds, to));
    tRef.current = v;
    setT(v);
    draw(v);
  }, [P.seconds, draw]);

  // A new film, or a change of motion: start again from the right frame.
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    setPlaying(false); setStarted(false);
    seek(live ? 0 : P.poster);
  }, [reel, live]); // eslint-disable-line react-hooks/exhaustive-deps

  // The clock. React hears about the time a few times a second, for the scrubber and captions.
  useEffect(() => {
    if (!playing) return;
    let last = performance.now(), lastUi = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      let v = tRef.current + dt * prefs.rate;
      if (v >= P.seconds) {
        if (prefs.loop) v = 0;
        else { tRef.current = P.seconds; draw(P.seconds); setT(P.seconds); setPlaying(false); return; }
      }
      tRef.current = v;
      draw(v);
      if (now - lastUi > 120) { lastUi = now; setT(v); }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf.current); setT(tRef.current); };
  }, [playing, prefs.rate, prefs.loop, P.seconds, draw]);

  // Plays by itself on screen (Full motion only); pauses off screen and in a hidden tab.
  const auto = useRef(false);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => {
      visible.current = e.isIntersecting;
      if (!e.isIntersecting) setPlaying(false);
      else if (live && autoPlay && !auto.current) { auto.current = true; setPlaying(true); }
    }, { threshold: 0.5 });
    io.observe(el);
    const onHide = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", onHide);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", onHide); };
  }, [live, autoPlay, reel]);
  useEffect(() => { auto.current = false; }, [reel]);

  const toggle = () => {
    if (!live && video && !started) { setStarted(true); return; }
    if (playing) { setPlaying(false); return; }
    if (tRef.current >= P.seconds - 0.05) seek(0);
    setStarted(true);
    setPlaying(true);
  };

  const onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "SELECT" || (tag === "BUTTON" && (e.key === " " || e.key === "Enter"))) return;
    const k = e.key.toLowerCase();
    if (k === " " || k === "k") { if (tag === "INPUT" && k === " ") return; e.preventDefault(); toggle(); }
    else if (k === "j") { e.preventDefault(); seek(tRef.current - 10); }
    else if (k === "l") { e.preventDefault(); seek(tRef.current + 10); }
    else if (k === "c") { e.preventDefault(); setPrefs({ captions: !prefs.captions }); }
  };

  const page = pageAt(P, t);
  const chapter = chapterAt(P, t);
  const beat = beatAt(P, t);
  const label = playing ? "Pause" : t >= P.seconds - 0.05 ? "Replay" : "Play";
  const motionValue: MotionPref = pref === "system" ? level : pref;
  const note = live ? "" : pref === "off"
    ? "Motion is off, so the film shows a still picture. Press play to watch it."
    : pref === "reduced"
      ? "Motion is reduced, so the film waits for you. Press play to watch it."
      : "Your device asks for less motion, so the film waits for you. Press play to watch it, or choose Full to have it play by itself.";

  return (
    <figure className={`rl-player ${className}`} ref={box} aria-label={`${title}: lesson film`} onKeyDown={onKey}>
      <div className="rl-stage" data-size={size}>
        {showVideo ? (
          <video className="rl-video" src={video!.mp4} controls autoPlay playsInline preload="auto" aria-label={`${title}: lesson film`} onEnded={() => setStarted(false)}>
            {video!.vtt && <track kind="captions" src={video!.vtt} srcLang="en" label="English" default />}
          </video>
        ) : (
          <>
            <div ref={stage} className="rl-frame" data-size={size} role="img" aria-label={reel.alt} />
            {live && prefs.captions && page && (
              <p className="rl-cc" aria-hidden="true">
                {page.words.map((w, i) => <span key={i} data-em={w.em || undefined} data-said={t >= w.at || undefined}>{w.text} </span>)}
              </p>
            )}
            {!playing && !live && (
              <button type="button" className="rl-big-play" onClick={toggle} aria-label={`Play the film: ${title}`}>
                <Icon name="play" size={28} />
              </button>
            )}
          </>
        )}
      </div>

      {!showVideo && (
        <div className="rl-bar">
          <button type="button" className="rl-btn" onClick={toggle} aria-label={label}>
            <Icon name={playing ? "pause" : label === "Replay" ? "restart" : "play"} size={16} />
          </button>
          <span className="rl-time" aria-hidden="true">{clock(t)} / {clock(P.seconds)}</span>
          <div className="rl-scrub">
            <input type="range" min={0} max={P.seconds} step={0.1} value={t}
              aria-label="Position in the film" aria-valuetext={`${clock(t)} of ${clock(P.seconds)}, ${chapter.title}`}
              onChange={(e) => { setPlaying(false); setStarted(true); seek(Number(e.currentTarget.value)); }} />
            <span className="rl-marks" aria-hidden="true">
              {P.chapters.slice(1).map((c) => <i key={c.at} style={{ left: `${(c.at / P.seconds) * 100}%` }} />)}
            </span>
          </div>
          <label className="rl-speed">
            <span className="rl-sr">Speed</span>
            <select value={prefs.rate} onChange={(e) => setPrefs({ rate: Number(e.currentTarget.value) })}>
              {SPEEDS.map((s) => <option key={s} value={s}>{s}x</option>)}
            </select>
          </label>
          <button type="button" className="rl-btn rl-txt" aria-pressed={prefs.captions} onClick={() => setPrefs({ captions: !prefs.captions })} title="Captions (C)">CC</button>
          <button type="button" className="rl-btn rl-txt" aria-pressed={prefs.loop} onClick={() => setPrefs({ loop: !prefs.loop })}>Loop</button>
        </div>
      )}

      <figcaption className="rl-foot">
        <p className="rl-now"><span className="rl-chapter">{chapter.title}</span> <span className="rl-line">{plain(beat.say)}</span></p>
        <div className="rl-row">
          <span className="rl-motion"><span className="rl-motion-l" aria-hidden="true">Motion</span>
            <Segmented size="sm" label="Motion" value={motionValue} onChange={writeMotionPref} options={[["full", "Full"], ["reduced", "Reduced"], ["off", "Off"]]} />
          </span>
          <span className="rl-spacer" />
          <Button size="sm" variant="ghost" onClick={() => setTranscript((v) => !v)} aria-expanded={transcript} aria-controls={ids.tr}>{transcript ? "Hide the transcript" : "Transcript"}</Button>
          {data && <Button size="sm" variant="ghost" onClick={() => setTable((v) => !v)} aria-expanded={table} aria-controls={ids.tb}>{table ? "Hide the numbers" : "Show the numbers"}</Button>}
        </div>
        {note && <p className="rl-note">{note}</p>}
        <div id={ids.tr} hidden={!transcript}>
          {transcript && (
            <ol className="rl-transcript">
              {P.beats.map((b) => (
                <li key={b.i}>
                  {b.chapter && <strong className="rl-tch">{b.chapter}</strong>}
                  <button type="button" className="rl-tline" onClick={() => { setPlaying(false); setStarted(true); seek(b.start + 0.01); }}>
                    <span className="rl-tt">{clock(b.start)}</span> {plain(b.say)}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
        {data && <div id={ids.tb} hidden={!table}>{table && <SignatureTable table={data} />}</div>}
      </figcaption>
    </figure>
  );
}
