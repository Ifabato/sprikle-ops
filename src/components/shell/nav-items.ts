import type { Role } from "@/domain/enums";

// Role-aware navigation. Hiding a link is a convenience only: every page authorizes on the server.

export type NavHref = "/dashboard" | "/work-orders" | "/analytics";
export type NavIcon = "dashboard" | "workOrders" | "analytics";

export interface NavItem {
  readonly href: NavHref;
  readonly label: string;
  readonly icon: NavIcon;
  readonly adminOnly: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", adminOnly: false },
  { href: "/work-orders", label: "Work orders", icon: "workOrders", adminOnly: false },
  { href: "/analytics", label: "Analytics", icon: "analytics", adminOnly: true },
];

export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.adminOnly || role === "ADMIN");
}

/** A link is current for its own path and any path beneath it. */
export function isCurrentPath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  ADMIN: "Administrator",
  TEAM_MEMBER: "Team member",
};
