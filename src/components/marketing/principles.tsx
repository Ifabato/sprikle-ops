import { Flag } from "lucide-react";

// Each rule is shown next to the record that proves it (sample values), not just stated.

function OverdueProof() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-caption">
      <span className="text-ink-secondary">Tue, Mar 10 · WO-000118 · due Mar 9 · In progress</span>
      <span aria-hidden="true" className="text-ink-secondary">
        →
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-signal-tint px-2.5 py-1 font-semibold text-signal-ink">
        <Flag aria-hidden="true" className="size-3.5 fill-signal stroke-signal-ink" />
        Overdue 1 day
      </span>
    </div>
  );
}

function ChangeProof() {
  return (
    <ol className="flex flex-col gap-1 font-mono text-caption text-ink-secondary">
      <li>
        Mar 10 · 13:05 · <span className="font-semibold text-ink">Blocked</span> by T. Reyes
      </li>
      <li>
        Mar 10 · 15:41 · <span className="font-semibold text-ink">Commented</span> by T. Reyes
      </li>
      <li>
        Mar 11 · 08:02 · <span className="font-semibold text-ink">Reassigned</span> by an admin
      </li>
    </ol>
  );
}

function NumberProof() {
  return (
    <div className="flex flex-col gap-2 font-mono text-caption">
      <p className="flex items-baseline gap-3">
        <span className="font-display text-h2 font-extrabold text-ink">4</span>
        <span className="text-ink">overdue on Sun, Mar 15</span>
      </p>
      <p className="text-ink-secondary">= WO-000118 · WO-000121 · WO-000124 · WO-000126</p>
    </div>
  );
}

const PRINCIPLES = [
  {
    title: "Overdue is a fact, not a flag.",
    text: "It follows from the due date and the status, so the list is right the moment you open it.",
    proof: <OverdueProof />,
  },
  {
    title: "Every change has a name on it.",
    text: "Assignments, status changes, and comments are attributed and kept in order, never edited away.",
    proof: <ChangeProof />,
  },
  {
    title: "Every count can show its records.",
    text: "Each metric is defined in writing, and counts trace back to the work orders they count.",
    proof: <NumberProof />,
  },
] as const;

export function Principles() {
  return (
    <section id="principles" aria-labelledby="principles-heading" className="scroll-mt-4">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <h2
          id="principles-heading"
          className="max-w-2xl font-display text-display-2 font-extrabold tracking-display text-balance text-ink"
        >
          Three rules it is built on.
        </h2>
        <ul className="divide-y divide-line border-y border-line-strong">
          {PRINCIPLES.map(({ title, text, proof }) => (
            <li
              key={title}
              className="grid gap-5 py-8 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] md:items-center md:gap-12 md:py-10"
            >
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-h1 font-extrabold tracking-heading text-balance text-ink">
                  {title}
                </h3>
                <p className="max-w-[44ch] text-body text-ink-secondary">{text}</p>
              </div>
              <div className="rounded-panel border border-line bg-surface px-4 py-4 shadow-sheet">
                {proof}
              </div>
            </li>
          ))}
        </ul>
        <p className="text-caption text-ink-secondary">Examples use sample data.</p>
      </div>
    </section>
  );
}
