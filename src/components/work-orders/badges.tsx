import { Ban, CircleCheck, CircleDot, CirclePause, CirclePlay } from "lucide-react";
import type { Priority, WorkOrderStatus } from "@/domain/enums";

// Status and priority, always icon plus text (never color alone).

const STATUS: Record<
  WorkOrderStatus,
  { label: string; icon: typeof CircleDot; className: string }
> = {
  OPEN: { label: "Open", icon: CircleDot, className: "bg-status-open-tint text-status-open" },
  IN_PROGRESS: {
    label: "In progress",
    icon: CirclePlay,
    className: "bg-status-progress-tint text-status-progress",
  },
  BLOCKED: {
    label: "Blocked",
    icon: CirclePause,
    className: "bg-status-blocked-tint text-status-blocked",
  },
  COMPLETED: {
    label: "Completed",
    icon: CircleCheck,
    className: "bg-status-completed-tint text-status-completed",
  },
  CANCELLED: {
    label: "Cancelled",
    icon: Ban,
    className: "bg-status-cancelled-tint text-status-cancelled",
  },
};

export function StatusBadge({ status }: { status: WorkOrderStatus }) {
  const { label, icon: Icon, className } = STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-semibold whitespace-nowrap ${className}`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </span>
  );
}

const PRIORITY_LEVEL: Record<Priority, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

/** Signal-bar icon (1–4 filled bars) plus the priority word. */
export function PriorityLabel({ priority }: { priority: Priority }) {
  const level = PRIORITY_LEVEL[priority];
  const loud = level >= 3;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-caption font-semibold whitespace-nowrap ${loud ? "text-ink" : "text-ink-secondary"}`}
    >
      <svg viewBox="0 0 14 12" aria-hidden="true" className="h-3 w-3.5">
        {[0, 1, 2, 3].map((bar) => (
          <rect
            key={bar}
            x={bar * 3.5}
            y={9 - bar * 3}
            width="2.5"
            height={3 + bar * 3}
            rx="0.6"
            className={
              bar < level ? (priority === "CRITICAL" ? "fill-signal" : "fill-ink") : "fill-line"
            }
          />
        ))}
      </svg>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
