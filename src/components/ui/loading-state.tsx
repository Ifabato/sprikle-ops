/** Layout-shaped loading state: page header and one panel, no placeholder data. */
export function LoadingState() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true" className="flex flex-col gap-3 border-b border-line pb-6">
        <div className="h-3 w-40 animate-pulse rounded-control bg-surface-sunken" />
        <div className="h-9 w-56 animate-pulse rounded-control bg-surface-sunken" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-control bg-surface-sunken" />
      </div>
      <div
        aria-hidden="true"
        className="h-40 max-w-3xl animate-pulse rounded-sheet bg-surface-sunken"
      />
    </div>
  );
}
