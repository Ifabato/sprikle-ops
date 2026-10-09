/** Page title band: heavy display title and an optional description. */
export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="flex flex-col gap-2 border-b border-line pb-6">
      <h1 className="font-display text-h1 font-bold tracking-heading text-balance text-ink">
        {title}
      </h1>
      {description ? (
        <p className="max-w-[60ch] text-body text-ink-secondary">{description}</p>
      ) : null}
    </header>
  );
}
