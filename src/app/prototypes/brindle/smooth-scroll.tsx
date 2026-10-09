"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { useEffect, type ReactNode } from "react";

gsap.registerPlugin(ScrollTrigger);

// Smooth scrolling for this prototype route only (never the authenticated app). Lenis is driven by
// GSAP's ticker (one animation clock) and feeds ScrollTrigger, per the Lenis + GSAP documentation.
// Reduced motion: Lenis is not started (native scrolling). Touch stays native (syncTouch off).
export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      autoRaf: false,
      anchors: true,
      syncTouch: false,
      allowNestedScroll: true,
      prevent: (node) => node.closest?.("[data-lenis-prevent]") != null,
    });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
