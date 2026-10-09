"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Check, Flag } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { BoardRow } from "@/components/marketing/board-model";
import { SAMPLE_ROWS, STATUS_LABEL, STORY_ACTIVITY } from "./sample";
import {
  JOB_LAYOUT,
  MODES,
  OWNERS,
  jobPositions,
  rowPath,
  strandPath,
  toView,
  ORIGIN,
  type Mode,
  type Owner,
} from "./geometry";
import Threads, { type ThreadsControl } from "./vendor/Threads";

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, MorphSVGPlugin, useGSAP);

// Brindle's signature scene. One sample request becomes three owners' strands; each strand weaves
// through the jobs that owner holds and converges on the record. Scrolling resolves each strand
// into its owner's row in the product view and carries the jobs into place. Selecting a job lights
// its owner's strand and shows the attributed history. Sample data; nothing runs automatically.

const STRAND_TONE = ["#e3ebff", "#a9c0ff", "#7d95dc"] as const;

const HISTORY: Record<string, { time: string; who: string; what: string }[]> = {
  "WO-000126": STORY_ACTIVITY.slice(0, 3).map((a) => ({
    time: a.time,
    who: a.event === "Created" ? "Operations manager" : "M. Lindqvist",
    what:
      a.event === "Assigned"
        ? "Assigned to M. Lindqvist"
        : a.event === "Blocked"
          ? a.detail
          : "Created from a call note",
  })),
  "WO-000118": [
    { time: "Mar 6, 09:10", who: "Operations manager", what: "Created" },
    { time: "Mar 9, 07:52", who: "T. Reyes", what: "Started work" },
  ],
  "WO-000121": [
    { time: "Mar 7, 14:30", who: "Operations manager", what: "Created, marked critical" },
    { time: "Mar 9, 11:05", who: "J. Okafor", what: "Blocked: waiting on a fan belt" },
  ],
  "WO-000124": [
    { time: "Mar 3, 10:00", who: "Operations manager", what: "Created and assigned to T. Reyes" },
  ],
  "WO-000127": [
    { time: "Mar 8, 16:12", who: "Operations manager", what: "Created and assigned to J. Okafor" },
  ],
  "WO-000115": [
    { time: "Mar 5, 08:20", who: "Operations manager", what: "Created" },
    { time: "Mar 8, 15:40", who: "M. Lindqvist", what: "Completed, recalibrated and tested" },
  ],
};

const pct = (n: number) => `${n / 10}%`;

type Size = { w: number; h: number };

// Before measurement (and without JS) the strands use a stretched 1000-unit viewBox with
// non-scaling strokes; once measured they are redrawn in pixel space so DrawSVG lengths are true.
function Strands({ mode, owner, size }: { mode: Mode; owner: Owner; size: Size | null }) {
  const s = size ? ([size.w / 1000, size.h / 1000] as const) : ([1, 1] as const);
  const [ox, oy] = toView(mode, ORIGIN);
  return (
    <svg
      data-mode={mode}
      viewBox={size ? `0 0 ${size.w} ${size.h}` : "0 0 1000 1000"}
      preserveAspectRatio={size ? undefined : "none"}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${mode === "desktop" ? "hidden lg:block" : "lg:hidden"}`}
    >
      {OWNERS.map((o, i) => (
        <path
          key={o}
          data-owner={i}
          d={strandPath(mode, o, s)}
          fill="none"
          stroke={STRAND_TONE[i]}
          strokeWidth={o === owner ? 2.4 : 1.4}
          strokeLinecap="round"
          vectorEffect={size ? undefined : "non-scaling-stroke"}
          className={`br-strand br-pending br-strand-state ${o === owner ? "br-strand-on" : "br-strand-off"}`}
        />
      ))}
      <circle
        cx={ox * s[0]}
        cy={oy * s[1]}
        r={4}
        fill="#ffffff"
        className="br-origin-dot br-pending"
      />
    </svg>
  );
}

function tone(row: BoardRow) {
  if (row.dueTone === "done") return "done";
  if (row.overdue) return "late";
  if (row.dueTone === "today") return "today";
  return "ahead";
}

export function StoryStage({ copy }: { copy: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const threads = useRef<ThreadsControl | null>(null);
  const [selected, setSelected] = useState("WO-000126");
  const owner = JOB_LAYOUT[selected]!.owner;
  const row = useMemo(() => SAMPLE_ROWS.find((r) => r.reference === selected)!, [selected]);
  const played = useRef(false);

  // Strands are drawn in the stage's pixel space; re-measure only when the stage really resizes.
  const [size, setSize] = useState<Size | null>(null);
  useEffect(() => {
    const el = canvasRef.current!;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry!.contentRect.width);
      const h = Math.round(entry!.contentRect.height);
      setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Entrance and scroll transformation (GSAP). gsap.matchMedia reverts everything on breakpoint
  // change and unmount; reduced motion keeps the static composition.
  useGSAP(
    () => {
      if (!size) return;
      const mm = gsap.matchMedia();
      mm.add(
        {
          desktop: "(min-width: 1024px)",
          mobile: "(max-width: 1023.98px)",
          reduce: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { desktop, reduce } = context.conditions as { desktop: boolean; reduce: boolean };
          const mode: Mode = desktop ? "desktop" : "mobile";
          const root = stageRef.current!;
          const canvas = canvasRef.current!;
          const reveal = () =>
            root.querySelectorAll(".br-pending").forEach((el) => el.classList.remove("br-pending"));

          if (reduce) {
            reveal();
            threads.current?.set({ paused: true });
            return;
          }

          const strands = gsap.utils.toArray<SVGPathElement>(
            `svg[data-mode="${mode}"] .br-strand`,
            root,
          );
          const intro = gsap.timeline({
            defaults: { ease: "power3.out" },
            onComplete: () => void (played.current = true),
          });
          intro
            .fromTo(".br-threads", { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.6 }, 0)
            .call(() => threads.current?.set({ paused: false }), [], 0.1)
            .fromTo(
              ".br-origin",
              { autoAlpha: 0, scale: 0.7 },
              { autoAlpha: 1, scale: 1, duration: 0.6 },
              0.55,
            )
            .fromTo(
              `svg[data-mode="${mode}"] .br-origin-dot`,
              { autoAlpha: 0 },
              { autoAlpha: 1, duration: 0.4 },
              0.6,
            )
            .fromTo(
              strands,
              { drawSVG: "0% 0%" },
              { drawSVG: "0% 100%", duration: 1.8, ease: "power2.inOut", stagger: 0.17 },
              0.75,
            )
            .fromTo(
              ".br-knot-in",
              { autoAlpha: 0, scale: 0.72, y: 10 },
              {
                autoAlpha: 1,
                scale: 1,
                y: 0,
                duration: 0.75,
                stagger: 0.085,
                ease: "back.out(1.7)",
              },
              1.45,
            )
            .fromTo(
              ".br-window",
              { autoAlpha: 0, y: 56 },
              { autoAlpha: 1, y: 0, duration: 1.15 },
              2.0,
            )
            .call(() => threads.current?.set({ paused: true }), [], 3.8)
            // Drawn strands stop using dashes so the scroll morph cannot leave gaps.
            .set(strands, { clearProps: "strokeDasharray,strokeDashoffset" }, 3.85);
          // A rebuild after a real resize lands on the finished state instead of replaying.
          if (played.current) intro.progress(1);
          reveal();

          // Scroll: strands resolve into product-view rows; jobs travel into their row slots.
          let idle: gsap.core.Tween | undefined;
          const scroll = gsap.timeline({
            scrollTrigger: {
              trigger: root,
              start: desktop ? "top top" : "top+=360 top",
              end: desktop ? "+=620" : "+=520",
              scrub: 0.9,
              invalidateOnRefresh: true,
              onUpdate: () => {
                if (intro.isActive()) intro.progress(1);
                threads.current?.set({ paused: false });
                idle?.kill();
                idle = gsap.delayedCall(0.45, () => threads.current?.set({ paused: true }));
              },
            },
          });
          strands.forEach((path) => {
            const o = OWNERS[Number(path.dataset.owner)]!;
            scroll.to(
              path,
              { morphSVG: rowPath(mode, o, [size.w / 1000, size.h / 1000]), ease: "power2.inOut" },
              0,
            );
          });
          gsap.utils.toArray<HTMLElement>(".br-knot", root).forEach((knot) => {
            const { scene, row: target } = jobPositions(mode, knot.dataset.ref!);
            scroll.to(
              knot,
              {
                x: () => ((target[0] - scene[0]) / 1000) * canvas.clientWidth,
                y: () => ((target[1] - scene[1]) / 1000) * canvas.clientHeight,
                ease: "power2.inOut",
              },
              0,
            );
          });
          scroll
            .to(".br-threads", { autoAlpha: 0.22, ease: "none" }, 0)
            .to(".br-origin", { autoAlpha: 0, y: -12, ease: "none" }, 0)
            .to(`svg[data-mode="${mode}"] .br-origin-dot`, { autoAlpha: 0, ease: "none" }, 0)
            .fromTo(".br-row-label", { autoAlpha: 0.35 }, { autoAlpha: 1, ease: "none" }, 0.4);
          scroll.eventCallback("onUpdate", () => {
            threads.current?.set({
              amplitude: 1.25 - 1.05 * scroll.progress(),
              distance: 0.45 - 0.3 * scroll.progress(),
            });
          });

          return () => idle?.kill();
        },
      );
    },
    { scope: stageRef, dependencies: [size], revertOnUpdate: true },
  );

  // Selection: light the owner's strand, wake the threads briefly, swap the record.
  const recordRef = useRef<HTMLDivElement>(null);
  function select(reference: string) {
    setSelected(reference);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    threads.current?.set({ paused: false, brightness: 1.5 });
    gsap.delayedCall(0.9, () => threads.current?.set({ paused: true, brightness: 1.05 }));
    if (recordRef.current) {
      gsap.fromTo(
        recordRef.current,
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out", overwrite: true },
      );
    }
  }

  return (
    <div ref={stageRef} className="relative lg:h-[1300px]">
      {copy}
      <div
        ref={canvasRef}
        className="relative mt-8 h-[1140px] lg:absolute lg:inset-0 lg:mt-0 lg:h-auto"
      >
        {/* Atmosphere: React Bits Threads (WebGL2), resting unless the story is moving. */}
        <div
          aria-hidden="true"
          className="br-threads br-pending pointer-events-none absolute inset-x-0 top-0 h-[40%] [mask-image:linear-gradient(to_bottom,black_55%,transparent)] lg:top-[2%] lg:h-[60%]"
        >
          <Threads
            controlRef={threads}
            paused
            color="#3f58b0"
            accentColor="#c3d3ff"
            lineCount={44}
            thickness={0.5}
            softness={1.5}
            amplitude={1.25}
            distance={0.45}
            waves={1}
            speed={0.35}
            split={0.03}
            fray={0.35}
            angle={12}
            taper={0.8}
            brightness={1.05}
            fade={0.35}
            opacity={0.7}
            enableMouseInteraction
          />
        </div>

        <Strands mode="desktop" owner={owner} size={size} />
        <Strands mode="mobile" owner={owner} size={size} />

        {/* The sample request every strand starts from. */}
        <p
          className="br-origin br-pending pointer-events-none absolute z-10 -translate-y-[140%] rounded-full border border-white/20 bg-[#0b1020]/80 px-3 py-1 font-mono text-[11px] text-[#c9d6f0] backdrop-blur-sm lg:hidden"
          style={
            {
              left: pct(toView("mobile", ORIGIN)[0]),
              top: pct(toView("mobile", ORIGIN)[1]),
            } as CSSProperties
          }
        >
          Call note, 08:39
        </p>
        <p
          className="br-origin br-pending pointer-events-none absolute z-10 hidden -translate-x-1/2 -translate-y-[150%] rounded-full border border-white/20 bg-[#0b1020]/80 px-3 py-1 font-mono text-[11px] text-[#c9d6f0] backdrop-blur-sm lg:block"
          style={
            {
              left: pct(toView("desktop", ORIGIN)[0]),
              top: pct(toView("desktop", ORIGIN)[1]),
            } as CSSProperties
          }
        >
          Call note, 08:39
        </p>

        {/* Jobs: knots on the strands; on scroll they settle into their owner's row. */}
        {SAMPLE_ROWS.map((r) => {
          const d = jobPositions("desktop", r.reference).scene;
          const m = jobPositions("mobile", r.reference).scene;
          const t = tone(r);
          const on = r.reference === selected;
          const mine = JOB_LAYOUT[r.reference]!.owner === owner;
          return (
            <div
              key={r.reference}
              data-ref={r.reference}
              className={`br-knot br-dim absolute top-(--my) left-(--mx) z-20 size-0 lg:top-(--ly) lg:left-(--lx) ${mine ? "" : "br-dimmed"}`}
              style={
                {
                  "--lx": pct(d[0]),
                  "--ly": pct(d[1]),
                  "--mx": pct(m[0]),
                  "--my": pct(m[1]),
                } as CSSProperties
              }
            >
              <div className="w-max -translate-x-1/2 -translate-y-1/2">
                <button
                  type="button"
                  onClick={() => select(r.reference)}
                  aria-pressed={on}
                  aria-label={`${r.title}, ${r.assignee}, ${r.dueLabel}`}
                  className={`br-knot-in br-pending br-knot-state flex items-center gap-2 rounded-[12px] border px-2.5 py-1.5 text-left backdrop-blur-md lg:px-3 lg:py-2 ${
                    t === "late"
                      ? "border-[#ff8a52]/70 bg-[#24110a] shadow-[0_0_24px_-8px_rgb(255_138_82/0.8)]"
                      : t === "today"
                        ? "border-[#ffcf73]/60 bg-[#211a0b]"
                        : t === "done"
                          ? "border-white/10 bg-[#0b0f19]"
                          : "border-white/15 bg-[#0e1424]"
                  } ${on ? "ring-2 ring-white ring-offset-2 ring-offset-[#05070c]" : ""}`}
                >
                  {t === "late" ? (
                    <Flag aria-hidden="true" className="size-3.5 shrink-0 text-[#ffa477]" />
                  ) : null}
                  {t === "done" ? (
                    <Check aria-hidden="true" className="size-3.5 shrink-0 text-[#8b96aa]" />
                  ) : null}
                  <span className="flex flex-col">
                    <span className="hidden max-w-[10.5rem] truncate text-[13px] font-semibold text-white lg:block">
                      {r.title}
                    </span>
                    <span
                      className={`font-mono text-[11px] whitespace-nowrap ${
                        t === "late"
                          ? "text-[#ffa477]"
                          : t === "today"
                            ? "text-[#ffd98f]"
                            : t === "done"
                              ? "text-[#8b96aa]"
                              : "text-[#aab6cc]"
                      }`}
                    >
                      <span className="lg:hidden">{r.reference.replace("WO-000", "#")} </span>
                      {r.dueLabel}
                    </span>
                  </span>
                </button>
              </div>
            </div>
          );
        })}

        {/* Product view: the attributed record the strands resolve into. */}
        <section
          id="record"
          aria-label="Illustrative product view, sample data"
          className="br-window br-pending absolute inset-x-0 top-[42%] bottom-0 overflow-hidden rounded-[24px] border border-white/10 bg-[#080c15]/95 shadow-[0_-40px_140px_-50px_rgb(110_150_255/0.55)] lg:inset-x-[2%] lg:top-[58%] lg:bottom-[10%]"
        >
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3">
            <p className="text-[12px] font-medium text-[#8f9bb1]">Work orders by owner</p>
            <p className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] whitespace-nowrap text-[#a3aec2]">
              Illustrative, sample data
            </p>
          </div>
          {OWNERS.map((o, i) => (
            <button
              key={o}
              type="button"
              onClick={() =>
                select(
                  Object.entries(JOB_LAYOUT).find(([, j]) => j.owner === o && j.slot === 1)![0],
                )
              }
              aria-pressed={o === owner}
              className={`br-row-label absolute -translate-y-1/2 rounded-md px-1.5 py-1 text-[12px] font-semibold whitespace-nowrap lg:text-[13px] ${o === owner ? "text-white" : "text-[#8f9bb1]"} top-(--rm) left-[4%] max-lg:-translate-y-[170%] lg:top-(--rd) lg:left-[1.5%]`}
              style={
                {
                  "--rd": `${((MODES.desktop.rowsY[i]! - 580) / (900 - 580)) * 100}%`,
                  "--rm": `${((MODES.mobile.rowsY[i]! - 420) / (1000 - 420)) * 100}%`,
                } as CSSProperties
              }
            >
              {o}
            </button>
          ))}
          <div className="absolute inset-x-[4%] bottom-[3%] lg:inset-x-auto lg:top-[16%] lg:right-[3%] lg:bottom-auto lg:w-[36%]">
            <div
              ref={recordRef}
              className="br-record-body rounded-[16px] border border-white/[0.08] bg-white/[0.03] p-4 lg:p-5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-mono text-[12px] text-[#9db8ff]">{row.reference}</p>
                <p className="text-[12px] text-[#8f9bb1]">{STATUS_LABEL[row.status]}</p>
              </div>
              <p className="mt-1 text-[17px] leading-snug font-semibold text-white lg:text-[19px]">
                {row.title}
              </p>
              <p className="mt-1 text-[13px] text-[#a3aec2]">
                {row.assignee} owns it. <span className="font-mono">{row.dueLabel}</span>.
              </p>
              <ol className="mt-3 flex flex-col">
                {HISTORY[row.reference]!.map((h) => (
                  <li
                    key={h.time}
                    className="grid grid-cols-[6.2rem_minmax(0,1fr)] gap-3 border-t border-white/[0.07] py-2"
                  >
                    <span className="font-mono text-[11px] text-[#8f9bb1]">{h.time}</span>
                    <span className="text-[13px] text-[#dbe3f1]">
                      <span className="font-semibold text-white">{h.who}</span> {h.what}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
