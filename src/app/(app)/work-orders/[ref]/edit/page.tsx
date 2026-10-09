import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { parseReference } from "@/domain/reference";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { PageHeader } from "@/components/ui/page-header";
import { WorkOrderForm } from "@/components/work-orders/work-order-form";
import { dateInputValue } from "@/lib/format";
import { getDb } from "@/server/db";
import { getWorkOrder, listAssignees, listServiceAreas } from "@/server/services/work-orders";
import { requireRole } from "@/server/session";
import { editWorkOrderAction } from "../../actions";

export const metadata: Metadata = { title: "Edit work order" };

// ADMIN only (AC-3). Status changes are not edited here; they use the status actions.
export default async function EditWorkOrderPage({ params }: PageProps<"/work-orders/[ref]/edit">) {
  const { ref } = await params;
  const access = await requireRole("ADMIN", `/work-orders/${ref}/edit`);
  if (access.forbidden) {
    return (
      <>
        <PageHeader title="Edit work order" />
        <ForbiddenState reason="Only administrators can edit work orders." />
      </>
    );
  }
  const parsed = parseReference(ref);
  if (!parsed.ok) notFound();
  const db = getDb();
  const [result, areas, assignees] = await Promise.all([
    getWorkOrder(db, access.actor, parsed.value.number, new Date()),
    listServiceAreas(db, access.actor),
    listAssignees(db, access.actor),
  ]);
  if (!result.ok) notFound();
  if (!areas.ok || !assignees.ok) throw new Error("Lookup failed");
  const order = result.data;

  // Keep the current values selectable even if they are no longer active, so saving an unrelated
  // change never silently reassigns the work or moves its service area.
  const assigneeOptions =
    order.assignee && !assignees.data.some((user) => user.id === order.assignee!.id)
      ? [...assignees.data, { id: order.assignee.id, name: `${order.assignee.name} (inactive)` }]
      : assignees.data;
  const areaOptions = areas.data.some((area) => area.id === order.serviceArea.id)
    ? areas.data
    : [...areas.data, { id: order.serviceArea.id, name: `${order.serviceArea.name} (inactive)` }];

  return (
    <>
      <PageHeader
        title={`Edit ${order.reference}`}
        description="Only changed fields are saved, and each change is recorded in the history."
      />
      <WorkOrderForm
        action={editWorkOrderAction}
        reference={order.reference}
        version={order.version}
        allowUnassign={order.status === "OPEN"}
        initial={{
          title: order.title,
          description: order.description,
          serviceAreaId: order.serviceArea.id,
          priority: order.priority,
          dueDate: dateInputValue(order.dueAt),
          assigneeId: order.assignee?.id ?? "",
        }}
        serviceAreas={areaOptions}
        assignees={assigneeOptions}
        submitLabel="Save changes"
        cancelHref={`/work-orders/${order.reference}` as Route}
      />
    </>
  );
}
