/*
 * Shimmer Button, from Magic UI (https://magicui.design/docs/components/shimmer-button),
 * listed on 21st.dev by Dillion Verma (https://21st.dev/community/components/dillionverma/shimmer-button).
 * Source: https://github.com/magicuidesign/magicui @ cdb348cb4c72a9b54b554d8617801e479fbc8714
 *         apps/www/registry/magicui/shimmer-button.tsx (keyframes from apps/www/registry/registry-ui.ts)
 * Copyright (c) Magic UI. MIT License (see ./LICENSE-magicui.md).
 *
 * Brindle modifications (marked "BRINDLE"):
 * 1. `cn` from "@/lib/utils" replaced by a local class joiner (no new package).
 * 2. The two infinite animations run once on entrance and once per hover/focus (no endless loop);
 *    keyframes live in ../brindle.css as br-shimmer-* classes. Renders as a link when `href` is set.
 */
import React, { type ComponentPropsWithoutRef, type CSSProperties } from "react";

// BRINDLE: local replacement for cn().
const cn = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

export interface ShimmerButtonProps extends ComponentPropsWithoutRef<"button"> {
  /** BRINDLE: render as a link when set. */
  href?: string;
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  className?: string;
  children?: React.ReactNode;
}

export const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      shimmerColor = "#ffffff",
      shimmerSize = "0.05em",
      shimmerDuration = "3s",
      borderRadius = "100px",
      background = "rgba(0, 0, 0, 1)",
      className,
      children,
      href,
      ...props
    },
    ref,
  ) => {
    // BRINDLE: link rendering for navigation actions.
    const Root = (href ? "a" : "button") as "button";
    return (
      <Root
        {...(href ? ({ href } as object) : {})}
        style={
          {
            "--spread": "90deg",
            "--shimmer-color": shimmerColor,
            "--radius": borderRadius,
            "--speed": shimmerDuration,
            "--cut": shimmerSize,
            "--bg": background,
          } as CSSProperties
        }
        className={cn(
          "group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden [border-radius:var(--radius)] border border-white/10 px-6 py-3 whitespace-nowrap text-white [background:var(--bg)]",
          "transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px",
          className,
        )}
        ref={ref}
        {...props}
      >
        {/* spark container */}
        <div
          className={cn("-z-30 blur-[2px]", "@container-[size] absolute inset-0 overflow-visible")}
        >
          {/* spark */}
          <div className="br-shimmer-slide absolute inset-0 aspect-[1] h-[100cqh] rounded-none [mask:none]">
            {/* spark before */}
            <div className="br-spin-around absolute -inset-full w-auto [translate:0_0] rotate-0 [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))]" />
          </div>
        </div>
        {children}

        {/* Highlight */}
        <div
          className={cn(
            "absolute inset-0 size-full",

            "rounded-2xl px-4 py-1.5 text-sm font-medium shadow-[inset_0_-8px_10px_#ffffff1f]",

            // transition
            "transform-gpu transition-all duration-300 ease-in-out",

            // on hover
            "group-hover:shadow-[inset_0_-6px_10px_#ffffff3f]",

            // on click
            "group-active:shadow-[inset_0_-10px_10px_#ffffff3f]",
          )}
        />

        {/* backdrop */}
        <div
          className={cn(
            "absolute inset-(--cut) -z-20 [border-radius:var(--radius)] [background:var(--bg)]",
          )}
        />
      </Root>
    );
  },
);

ShimmerButton.displayName = "ShimmerButton";
