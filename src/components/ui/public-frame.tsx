import { SiteHeader } from "@/components/marketing/site-header";

/** Frame for small public pages (not found): the site header over one aligned column. */
export function PublicFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader sections={false} />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">{children}</div>
      </main>
    </div>
  );
}
