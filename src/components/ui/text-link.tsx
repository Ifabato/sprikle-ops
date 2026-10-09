import Link from "next/link";
import type { Route } from "next";

/** Standalone text link: ink with a neutral underline that darkens on hover; 44px touch target. */
export function TextLink({ href, children }: { href: Route; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center self-start rounded-control text-table font-semibold text-ink underline decoration-line-strong decoration-2 underline-offset-[6px] transition-colors duration-150 hover:decoration-ink"
    >
      {children}
    </Link>
  );
}
