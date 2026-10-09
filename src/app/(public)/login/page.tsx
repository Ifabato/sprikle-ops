import type { Metadata, Route } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/wordmark";
import { SampleBoard } from "@/components/marketing/sample-board";
import { safeReturnPath } from "@/lib/return-path";
import { authorize } from "@/server/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const returnTo = safeReturnPath(Array.isArray(next) ? next[0] : next);

  // Only an active, authorized session skips the form. Inactive or expired sessions are not
  // authorized, so they see the form instead of bouncing between login and the dashboard.
  const access = await authorize(await headers());
  if (access.ok) {
    // returnTo is a sanitized in-app path (safeReturnPath), which typed routes cannot verify.
    redirect(returnTo as Route);
  }

  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-1">
      <aside className="on-rail flex flex-col justify-between gap-10 bg-rail px-4 py-5 text-rail-text sm:px-8 lg:px-14 lg:py-12">
        <Link href="/" className="self-start rounded-control py-2" aria-label="Brindle home">
          <Wordmark onDark />
        </Link>
        <div className="hidden flex-col gap-8 lg:flex">
          <p className="max-w-md font-display text-display-2 font-extrabold tracking-display text-balance text-white">
            Every work order owned. Every risk in view.
          </p>
          <div className="max-w-lg">
            <SampleBoard compact />
          </div>
        </div>
        <p className="hidden text-caption text-rail-muted lg:block">
          In development. The board above shows sample data.
        </p>
      </aside>
      <main
        id="main-content"
        tabIndex={-1}
        className="flex justify-center px-4 py-12 focus:outline-none sm:px-8 lg:items-center lg:py-16"
      >
        <div className="flex w-full max-w-sm flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-h1 font-bold tracking-heading text-ink">Sign in</h1>
            <p className="text-table text-ink-secondary">
              Use the account your administrator created for you.
            </p>
          </div>
          <LoginForm returnTo={returnTo} />
          <Link
            href="/"
            className="inline-flex min-h-11 items-center self-start rounded-control text-table font-semibold text-ink-secondary underline decoration-line-control underline-offset-[6px] hover:text-ink"
          >
            About Brindle
          </Link>
        </div>
      </main>
    </div>
  );
}
