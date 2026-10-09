import type { Metadata } from "next";
import { headers } from "next/headers";
import { ROLE_LABELS } from "@/components/shell/nav-items";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/server/current-user";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Profile" };

// Read-only: there are no profile or password changes in the MVP.
export default async function ProfilePage() {
  await requireUser("/profile");
  const user = await getCurrentUser(await headers());
  if (!user) {
    return null;
  }

  const rows: [string, string][] = [
    ["Name", user.name],
    ["Email", user.email],
    ["Role", ROLE_LABELS[user.actor.role]],
    ["Account status", "Active"],
  ];

  return (
    <>
      <PageHeader
        title="Profile"
        description="Your account details. Contact an administrator to change them."
      />
      <dl className="-mt-8 divide-y divide-line border-b border-line-strong">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-1 gap-1 py-4 sm:grid-cols-[14rem_1fr] sm:items-baseline sm:gap-6"
          >
            <dt className="text-label font-semibold text-ink-secondary">{label}</dt>
            <dd className="text-body break-words text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
