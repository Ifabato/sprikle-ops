import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <Wordmark />
        <p className="text-caption text-ink-secondary">
          Work-order and operations platform for small service businesses · In development
        </p>
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center self-start rounded-control text-table font-semibold text-ink underline decoration-line-strong decoration-2 underline-offset-[6px] sm:self-auto"
        >
          Sign in
        </Link>
      </div>
    </footer>
  );
}
