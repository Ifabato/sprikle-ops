const STEPS = [
  {
    step: "Create",
    who: "Operations manager",
    text: "Record the job once: title, service area, priority, and a due date. It gets a reference like WO-000126.",
    entry: {
      time: "Mar 9 · 08:42",
      event: "Created",
      detail: "Leaking valve in boiler room · High",
    },
  },
  {
    step: "Assign",
    who: "Operations manager",
    text: "Give it one owner. The technician sees it in their own list; nobody else's work clutters it.",
    entry: { time: "Mar 9 · 08:44", event: "Assigned", detail: "to M. Lindqvist" },
  },
  {
    step: "Work",
    who: "Technician, on a phone",
    text: "Start it, block it with a reason, comment on it. Every change is recorded with who made it and when.",
    entry: { time: "Mar 10 · 13:05", event: "Blocked", detail: "Waiting on replacement valve kit" },
  },
  {
    step: "Close",
    who: "Technician or manager",
    text: "Complete or cancel it. Finished work never shows as overdue, whatever its due date was.",
    entry: {
      time: "Mar 11 · 16:20",
      event: "Completed",
      detail: "Valve replaced, pressure tested",
    },
  },
  {
    step: "Review",
    who: "Operations manager",
    text: "See what is overdue, blocked, or critical right now, and trace every number back to the records it counts.",
    entry: {
      time: "Planned",
      event: "Dashboard",
      detail: "Counts link to the matching work orders",
    },
  },
] as const;

/** Navy band: the workflow told as one job's append-only activity trail (sample data). */
export function Workflow() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="workflow-heading"
      className="on-rail scroll-mt-4 bg-rail text-rail-text"
    >
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16 lg:px-8 lg:py-28">
        <div className="flex flex-col gap-5 lg:sticky lg:top-10 lg:self-start">
          <h2
            id="workflow-heading"
            className="font-display text-display-2 font-extrabold tracking-display text-balance text-white"
          >
            One job, one record, from first call to closed.
          </h2>
          <p className="text-body text-rail-muted">
            Brindle is being built around this workflow. Each step adds to an activity trail that
            can only grow, so the history of a job is never rewritten.
          </p>
        </div>
        <ol className="relative flex flex-col">
          <span
            aria-hidden="true"
            className="absolute top-3 bottom-3 left-[0.6875rem] w-px bg-rail-line"
          />
          {STEPS.map(({ step, who, text, entry }) => (
            <li
              key={step}
              className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-5 pb-10 last:pb-0"
            >
              <span
                aria-hidden="true"
                className={`relative mt-1.5 size-[1.375rem] rounded-full border-2 ${
                  entry.time === "Planned"
                    ? "border-dashed border-rail-muted bg-rail"
                    : "border-rail-text bg-rail-deep"
                }`}
              />
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-8">
                <div className="flex flex-col gap-1.5">
                  <h3 className="font-display text-h2 font-bold tracking-heading text-white">
                    {step}
                  </h3>
                  <p className="text-label font-semibold text-rail-muted">{who}</p>
                  <p className="text-table text-rail-text">{text}</p>
                </div>
                <div className="self-start rounded-panel border border-rail-line bg-rail-deep px-4 py-3 font-mono text-caption">
                  <p className="text-rail-muted">
                    {entry.time === "Planned" ? "Planned" : `WO-000126 · ${entry.time}`}
                  </p>
                  <p className="mt-1 text-rail-text">
                    <span className="font-semibold text-white">{entry.event}</span> · {entry.detail}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-10 font-mono text-caption text-rail-muted sm:px-6 lg:px-8">
        Activity entries are sample data for illustration.
      </p>
    </section>
  );
}
