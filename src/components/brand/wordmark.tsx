/**
 * The Sprikle Ops mark: two job rows crossed by the orange "today" line; the top row runs past it
 * (overdue). Decorative; the wordmark text carries the name.
 */
export function BrandMark({
  className = "size-6",
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
      <rect
        x="0"
        y="0"
        width="24"
        height="24"
        rx="5"
        className={onDark ? "fill-white" : "fill-ink"}
      />
      <rect
        x="4.5"
        y="7"
        width="13"
        height="3"
        rx="1.5"
        className={onDark ? "fill-ink" : "fill-white"}
      />
      <rect
        x="4.5"
        y="14"
        width="7.5"
        height="3"
        rx="1.5"
        className={onDark ? "fill-ink/45" : "fill-white/55"}
      />
      <rect x="14.25" y="4" width="2" height="16" rx="1" className="fill-signal" />
    </svg>
  );
}

export function Wordmark({
  onDark = false,
  className = "",
}: {
  onDark?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <BrandMark onDark={onDark} />
      <span
        className={`font-display text-wordmark font-bold tracking-heading ${onDark ? "text-white" : "text-ink"}`}
      >
        Sprikle Ops
      </span>
    </span>
  );
}
