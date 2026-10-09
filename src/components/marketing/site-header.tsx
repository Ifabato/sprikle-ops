import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { BUTTON_BASE, BUTTON_VARIANTS } from "@/components/ui/button";

/** Public header; the same container as the page body so the wordmark aligns with the content. */
export function SiteHeader({ sections = true }: { sections?: boolean }) {
  return (
    <header className="border-b border-line bg-surface-page/90">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="rounded-control py-2" aria-label="Sprikle Ops home">
          <Wordmark />
        </Link>
        <nav aria-label="Site" className="flex items-center gap-1 sm:gap-2">
          {sections ? (
            <ul className="hidden items-center gap-1 md:flex">
              {[
                ["#how-it-works", "How it works"],
                ["#principles", "Principles"],
                ["#contact", "Contact"],
              ].map(([href, label]) => (
                <li key={href}>
                  <a
                    href={href}
                    className="inline-flex min-h-11 items-center rounded-control px-3 text-table font-medium text-ink-secondary transition-colors duration-150 hover:text-ink"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <Link href="/login" className={`${BUTTON_BASE} ${BUTTON_VARIANTS.primary} px-4`}>
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
