import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import "./brindle.css";
import { StoryStage } from "./story-stage";
import { ShimmerButton } from "./vendor/ShimmerButton";
import SplitText from "./vendor/SplitText";

// BRINDLE hero prototype (temporary). Huly-anchored composition (dark stage, left headline, one
// action, product staged below the fold) with an original scene: a request's strands weave through
// owners' jobs and resolve into the record. GSAP choreography, Lenis on this route only.

export const metadata: Metadata = { title: { absolute: "Brindle (prototype)" } };

function Mark() {
  return (
    <span
      aria-hidden="true"
      className="relative grid size-7 place-items-center rounded-[9px] bg-white"
    >
      <svg viewBox="0 0 20 20" className="size-4" fill="none">
        <path
          d="M3 6 C 8 6, 12 14, 17 14"
          stroke="#05070c"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M3 14 C 8 14, 12 6, 17 6"
          stroke="#05070c"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

const HEADLINE_MOTION = {
  tag: "span" as const,
  splitType: "chars" as const,
  delay: 22,
  duration: 0.9,
  textAlign: "left" as const,
  from: { opacity: 0, y: 34 },
  to: { opacity: 1, y: 0 },
  className: "br-headline block",
};

function Copy() {
  return (
    <div className="relative z-30 pt-10 lg:absolute lg:top-[8.5%] lg:left-0 lg:max-w-[33rem] lg:pt-0">
      <h1 className="text-[46px] leading-[1.02] font-semibold tracking-[-0.045em] sm:text-[60px] lg:text-[74px]">
        <SplitText text="Every request," {...HEADLINE_MOTION} />
        <SplitText text="woven into one record." {...HEADLINE_MOTION} />
      </h1>
      <p className="mt-6 max-w-[29rem] text-[17px] leading-relaxed text-(--br-muted) sm:text-[19px]">
        Brindle gives every job an owner, a due date, and a history the whole team reads.
      </p>
      <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
        <ShimmerButton
          href="#record"
          shimmerColor="#c9d8ff"
          shimmerDuration="2.4s"
          background="rgba(14, 20, 36, 1)"
          className="min-h-12 gap-2 px-7 text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          See the record
          <ArrowRight aria-hidden="true" className="size-4" />
        </ShimmerButton>
        <p className="text-[13px] text-[#7f8a9c]">In development. Contact details coming soon.</p>
      </div>
    </div>
  );
}

export default function BrindleHero() {
  return (
    <div className="br-root min-h-dvh bg-(--br-canvas) text-(--br-ink) [color-scheme:dark]">
      <noscript>
        <style>{`.br-root .br-pending, .split-parent { opacity: 1 !important; }`}</style>
      </noscript>
      <div className="br-grain relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute top-[-12%] right-[-12%] h-[60%] w-[70%] rounded-full bg-[radial-gradient(closest-side,rgb(64_92_210/0.32),transparent)] blur-2xl" />
          <div className="absolute top-[30%] left-[-20%] h-[50%] w-[60%] rounded-full bg-[radial-gradient(closest-side,rgb(36_52_118/0.32),transparent)] blur-2xl" />
        </div>

        <header className="relative z-40 mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <Link
            href="/prototypes/brindle"
            className="flex items-center gap-2.5 rounded-lg text-[18px] font-semibold tracking-[-0.02em] text-white"
          >
            <Mark />
            Brindle
          </Link>
          <nav aria-label="Site" className="flex items-center gap-2">
            <a
              href="#next"
              className="br-navlink hidden pb-0.5 text-[14px] text-(--br-muted) md:inline"
            >
              How it works
            </a>
            <span className="mx-3 hidden h-4 w-px bg-white/15 md:block" />
            <Link
              href="/login"
              className="inline-flex min-h-10 items-center rounded-full border border-white/25 px-4 text-[13px] font-semibold text-white transition-[background-color,border-color,transform] duration-200 hover:border-white/60 hover:bg-white/[0.06] active:scale-[0.97]"
            >
              Sign in
            </Link>
          </nav>
        </header>

        <main>
          <section
            aria-label="Introduction"
            className="relative mx-auto max-w-[1240px] px-5 sm:px-8"
          >
            <StoryStage copy={<Copy />} />
          </section>

          <section
            id="next"
            aria-labelledby="next-heading"
            className="relative z-10 mt-24 bg-[#eef0f4] pt-24 text-[#0b0f17] lg:mt-28 lg:pt-32"
          >
            <div className="mx-auto max-w-[1240px] px-5 pb-28 sm:px-8">
              <h2
                id="next-heading"
                className="max-w-[16ch] text-[40px] leading-[1.02] font-semibold tracking-[-0.045em] sm:text-[56px]"
              >
                From a phone call to a closed job.
              </h2>
              <p className="mt-5 max-w-[34rem] text-[18px] text-[#4b5466]">
                <strong className="font-semibold text-[#0b0f17]">
                  A person writes it down once.
                </strong>{" "}
                Everyone after that reads and updates the same job, and every change keeps the name
                of who made it.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
