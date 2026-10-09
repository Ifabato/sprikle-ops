import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { NavLinks } from "./nav-links";
import type { NavItem } from "./nav-items";
import { UserPanel } from "./user-panel";

/** Desktop navigation rail (≥ 768px). */
export function AppRail({
  items,
  userName,
  roleLabel,
}: {
  items: readonly NavItem[];
  userName: string;
  roleLabel: string;
}) {
  return (
    <aside className="on-rail sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-rail px-3 py-5 md:flex">
      <Link
        href="/dashboard"
        className="mb-8 self-start rounded-control px-3 py-2"
        aria-label="Brindle dashboard"
      >
        <Wordmark onDark />
      </Link>
      <nav aria-label="Main" className="flex-1">
        <NavLinks items={items} />
      </nav>
      <UserPanel name={userName} roleLabel={roleLabel} />
    </aside>
  );
}
