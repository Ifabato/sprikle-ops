import { CircleAlert } from "lucide-react";
import type { ReactNode, Ref } from "react";

/**
 * Error summary region. The live region stays mounted (even when empty) so screen readers
 * announce messages that appear later; it takes no space while empty. Focusable so a form can move
 * focus to it when an error appears.
 */
export function AlertRegion({
  message,
  id,
  ref,
}: {
  message: ReactNode | null;
  id?: string;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      id={id}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      tabIndex={-1}
      className="mb-5 rounded-control empty:mb-0"
    >
      {message ? (
        <p className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger-tint px-3 py-2.5 text-table text-danger">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{message}</span>
        </p>
      ) : null}
    </div>
  );
}
