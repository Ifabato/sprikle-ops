import { PublicFrame } from "@/components/ui/public-frame";
import { TextLink } from "@/components/ui/text-link";

export default function NotFound() {
  return (
    <PublicFrame>
      <section aria-labelledby="not-found-heading" className="flex max-w-2xl flex-col gap-4">
        <h1
          id="not-found-heading"
          className="font-display text-display-2 font-extrabold tracking-display text-ink"
        >
          Page not found
        </h1>
        <p className="text-body text-ink-secondary">
          This page does not exist, or you do not have access to it.
        </p>
        <div className="flex flex-wrap gap-x-6">
          <TextLink href="/">Go to the home page</TextLink>
          <TextLink href="/dashboard">Go to the dashboard</TextLink>
        </div>
      </section>
    </PublicFrame>
  );
}
