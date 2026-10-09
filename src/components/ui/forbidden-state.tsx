import { TextLink } from "./text-link";

/**
 * Shown under the page header to signed-in users whose role does not allow the page. The decision
 * is made on the server; this only presents it.
 */
export function ForbiddenState({
  reason = "Analytics is available to administrators only.",
}: {
  reason?: string;
}) {
  return (
    <section aria-labelledby="forbidden-heading" className="flex max-w-2xl flex-col gap-3">
      <h2
        id="forbidden-heading"
        className="font-display text-h2 font-extrabold tracking-heading text-ink"
      >
        You don&apos;t have access to this page.
      </h2>
      <p className="text-body text-ink-secondary">{reason} Your role was checked on the server.</p>
      <TextLink href="/dashboard">Go to the dashboard</TextLink>
    </section>
  );
}
