"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "./nav-icon";
import { isCurrentPath, type NavItem } from "./nav-items";

/** Navigation links on the navy rail; the current page gets aria-current and a 3px indicator. */
export function NavLinks({
  items,
  onNavigate,
}: {
  items: readonly NavItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const current = isCurrentPath(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={current ? "page" : undefined}
              className={`relative flex min-h-11 items-center gap-3 rounded-control px-3 text-table font-medium transition-colors duration-150 ${
                current
                  ? "bg-rail-active text-white before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-signal-on-rail"
                  : "text-rail-text hover:bg-rail-active/60"
              }`}
            >
              <NavIcon name={item.icon} className="size-4.5 shrink-0" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
