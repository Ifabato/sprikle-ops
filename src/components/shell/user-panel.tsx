"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isCurrentPath } from "./nav-items";
import { SignOutButton } from "./sign-out-button";

function initials(name: string): string {
  const parts = name
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** Signed-in user, profile link, and sign-out, at the bottom of the rail and the mobile menu. */
export function UserPanel({
  name,
  roleLabel,
  onNavigate,
}: {
  name: string;
  roleLabel: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const current = isCurrentPath(pathname, "/profile");
  return (
    <div className="flex flex-col gap-1 border-t border-rail-active pt-3">
      <Link
        href="/profile"
        onClick={onNavigate}
        aria-current={current ? "page" : undefined}
        className={`relative flex min-h-11 items-center gap-3 rounded-control px-3 py-1.5 transition-colors duration-150 ${
          current
            ? "bg-rail-active before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-signal-on-rail"
            : "hover:bg-rail-active/60"
        }`}
      >
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-rail-deep font-display text-label font-bold text-white ring-1 ring-rail-line"
        >
          {initials(name)}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-table font-semibold text-white">{name}</span>
          <span className="text-caption text-rail-muted">
            {roleLabel}
            <span className="sr-only"> · view profile</span>
          </span>
        </span>
      </Link>
      <SignOutButton />
    </div>
  );
}
