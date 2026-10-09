import type { Metadata } from "next";
import { localDateOf } from "@/domain/time";
import { formatDateOnly } from "@/domain/time";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { PageHeader } from "@/components/ui/page-header";
import { WorkOrderForm } from "@/components/work-orders/work-order-form";
import { getDb } from "@/server/db";
import { listAssignees, listServiceAreas } from "@/server/services/work-orders";
import { requireRole } from "@/server/session";
import { createWorkOrderAction } from "../actions";

export const metadata: Metadata = { title: "New work order" };

// ADMIN only (AC-2). Team members get the forbidden view; the action re-checks on the server.
export default async function NewWorkOrderPage() {
  const access = await requireRole("ADMIN", "/work-orders/new");
  if (access.forbidden) {
    return (
      <>
        <PageHeader title="New work order" />
        <ForbiddenState reason="Only administrators can create work orders." />
      </>
    );
  }
  const db = getDb();
  const [areas, assignees] = await Promise.all([
    listServiceAreas(db, access.actor),
    listAssignees(db, access.actor),
  ]);
  if (!areas.ok || !assignees.ok) throw new Error("Lookup failed");
  const today = formatDateOnly(localDateOf(new Date()));

  return (
    <>
      <PageHeader
        title="New work order"
        description="Every field except the assignee is required. The work order starts as Open."
      />
      <WorkOrderForm
        action={createWorkOrderAction}
        initial={{
          title: "",
          description: "",
          serviceAreaId: "",
          priority: "MEDIUM",
          dueDate: "",
          assigneeId: "",
        }}
        serviceAreas={areas.data}
        assignees={assignees.data}
        submitLabel="Create work order"
        cancelHref="/work-orders"
        minDueDate={today}
      />
    </>
  );
}
