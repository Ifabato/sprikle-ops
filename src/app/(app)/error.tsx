"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Unexpected-error state: retry plus a reference code when Next.js provides one. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section role="alert" aria-labelledby="error-heading" className="flex max-w-2xl flex-col gap-4">
      <h1
        id="error-heading"
        className="font-display text-h1 font-extrabold tracking-heading text-ink"
      >
        Something went wrong.
      </h1>
      <p className="text-body text-ink-secondary">
        This page could not be loaded. Try again; if it keeps happening, share the reference below.
      </p>
      <p className="text-label text-ink-secondary">
        {error.digest ? (
          <>
            Reference: <span className="font-mono">{error.digest}</span>
          </>
        ) : (
          "No reference code is available for this error."
        )}
      </p>
      <div>
        <Button variant="secondary" onClick={reset}>
          <RotateCcw aria-hidden="true" className="size-4" />
          Try again
        </Button>
      </div>
    </section>
  );
}
