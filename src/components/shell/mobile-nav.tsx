"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { NavLinks } from "./nav-links";
import type { NavItem } from "./nav-items";
import { UserPanel } from "./user-panel";

const PANEL_ID = "mobile-navigation";

/**
 * Mobile top bar (< 768px) with an in-place expanding menu. The panel is only rendered while open,
 * so its links are never focusable when hidden. Escape closes it and returns focus to the button;
 * navigating also closes it.
 */
export function MobileNav({
  items,
  userName,
  roleLabel,
}: {
  items: readonly NavItem[];
  userName: string;
  roleLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Close when the route changes (covers browser back/forward as well as link clicks).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className="on-rail bg-rail md:hidden">
      <div className="flex min-h-14 items-center justify-between px-4">
        <Link href="/dashboard" className="rounded-control py-2" aria-label="Sprikle Ops dashboard">
          <Wordmark onDark />
        </Link>
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls={PANEL_ID}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 items-center gap-2 rounded-control px-3 text-table font-semibold text-rail-text hover:bg-rail-active/60"
        >
          {open ? (
            <X aria-hidden="true" className="size-5" />
          ) : (
            <Menu aria-hidden="true" className="size-5" />
          )}
          Menu
        </button>
      </div>
      {open ? (
        <div
          id={PANEL_ID}
          className="flex flex-col gap-3 border-t border-rail-active px-3 pt-3 pb-4"
        >
          <nav aria-label="Main">
            <NavLinks items={items} onNavigate={() => setOpen(false)} />
          </nav>
          <UserPanel name={userName} roleLabel={roleLabel} onNavigate={() => setOpen(false)} />
        </div>
      ) : null}
    </header>
  );
}
