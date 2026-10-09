import { ArrowDown } from "lucide-react";
import { ContactAction } from "./contact-action";
import { SampleBoard } from "./sample-board";

// Grid areas: promise (top left), board (right, spanning), actions (bottom left). On phones the DOM
// order puts the working board directly after the promise, inside the first viewport.
export function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 pt-8 pb-20 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,6fr)_minmax(0,7fr)] lg:grid-rows-[auto_auto] lg:gap-x-14 lg:gap-y-8 lg:px-8 lg:pt-20 lg:pb-28">
        <div className="flex flex-col gap-5 lg:col-start-1 lg:row-start-1 lg:self-end">
          <h1
            id="hero-heading"
            className="font-display text-display font-extrabold tracking-display text-balance text-ink"
          >
            Know what&apos;s at risk before it&apos;s late.
          </h1>
          <p className="max-w-[34rem] text-body text-ink-secondary sm:text-lead">
            One accountable record for every work order: who owns it, when it&apos;s due, and what
            changed. Risk is computed from the record, never typed in.
          </p>
        </div>
        <div className="flex flex-col gap-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:-mr-16 lg:self-center">
          <SampleBoard />
          <p className="text-caption text-ink-secondary">
            Drag the sample day. Labels and order are recalculated from each due date with the same
            rules the app uses.
          </p>
        </div>
        <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-2 lg:self-start">
          <div className="flex flex-wrap items-center gap-3">
            <ContactAction />
            <a
              href="#how-it-works"
              className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-table font-semibold text-ink underline decoration-line-strong decoration-2 underline-offset-[6px] transition-colors duration-150 hover:decoration-ink"
            >
              See how work moves
              <ArrowDown aria-hidden="true" className="size-4" />
            </a>
          </div>
          <p className="flex items-start gap-2.5 border-t border-line pt-5 text-table text-ink-secondary">
            <span aria-hidden="true" className="mt-[0.45em] size-2 shrink-0 rounded-full bg-ink" />
            <span>
              <strong className="font-semibold text-ink">In development.</strong> Sign-in, roles,
              and the app shell are built; work orders, the dashboard, and analytics come next.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
