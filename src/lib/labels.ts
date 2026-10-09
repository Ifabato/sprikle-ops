import type { Priority, Role, WorkOrderStatus } from "@/domain/enums";

// Human-readable labels shared by the UI and activity descriptions. Client-safe.

export const STATUS_LABELS: Readonly<Record<WorkOrderStatus, string>> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const PRIORITY_LABELS: Readonly<Record<Priority, string>> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  ADMIN: "Administrator",
  TEAM_MEMBER: "Team member",
};

/** Verb shown on the button that moves work to a status, given where it is now. */
export function transitionActionLabel(from: WorkOrderStatus, to: WorkOrderStatus): string {
  if (to === "IN_PROGRESS") {
    if (from === "COMPLETED") return "Reopen";
    if (from === "BLOCKED") return "Unblock";
    return "Start work";
  }
  if (to === "OPEN") return from === "CANCELLED" ? "Restore" : "Move back to open";
  if (to === "BLOCKED") return "Mark blocked";
  if (to === "COMPLETED") return "Mark completed";
  return "Cancel work order";
}
