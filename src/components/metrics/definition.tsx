import { Info } from "lucide-react";

/** "How is this calculated?" disclosure with the metric's written definition (AC-9, metrics.md). */
export function Definition({ children }: { children: React.ReactNode }) {
  return (
    <details className="group text-caption text-ink-secondary">
      <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1.5 rounded-control font-semibold text-ink-secondary hover:text-ink [&::-webkit-details-marker]:hidden">
        <Info aria-hidden="true" className="size-3.5" />
        How is this calculated?
      </summary>
      <div className="mt-1 max-w-[60ch] leading-relaxed">{children}</div>
    </details>
  );
}

export function percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 1000) / 10}%`;
}
