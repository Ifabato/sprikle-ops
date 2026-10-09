import { headers } from "next/headers";
import { AppRail } from "@/components/shell/app-rail";
import { MobileNav } from "@/components/shell/mobile-nav";
import { navItemsFor, ROLE_LABELS } from "@/components/shell/nav-items";
import { SessionKeepalive } from "@/components/shell/session-keepalive";
import { getCurrentUser } from "@/server/current-user";

// Authenticated shell. Each page authorizes itself with the 4A guards (preserving its own return
// path); this layout only reads the current user to render role-aware navigation. Without a
// usable session it renders the page alone, and the page's guard redirects to login.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser(await headers());
  if (!user) {
    return <>{children}</>;
  }

  const items = navItemsFor(user.actor.role);
  const roleLabel = ROLE_LABELS[user.actor.role];

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <SessionKeepalive />
      <MobileNav items={items} userName={user.name} roleLabel={roleLabel} />
      <AppRail items={items} userName={user.name} roleLabel={roleLabel} />
      <main
        id="main-content"
        tabIndex={-1}
        className="min-w-0 flex-1 px-4 py-8 focus:outline-none md:px-12 md:py-12"
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-8">{children}</div>
      </main>
    </div>
  );
}
