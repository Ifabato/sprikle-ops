import { ChartColumn, ClipboardList, LayoutDashboard } from "lucide-react";
import type { NavIcon as NavIconName } from "./nav-items";

const ICONS = {
  dashboard: LayoutDashboard,
  workOrders: ClipboardList,
  analytics: ChartColumn,
} as const;

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon aria-hidden="true" className={className} />;
}
