"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { FormState } from "@/app/(app)/work-orders/actions";
import type { WorkOrderStatus } from "@/domain/enums";
import { STATUS_LABELS, transitionActionLabel } from "@/lib/labels";
import { AlertRegion } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/field";

const NEEDS_NOTE: readonly WorkOrderStatus[] = ["BLOCKED", "CANCELLED"];

/**
 * Status actions the viewer may take (from the server's allowedTransitions; the server re-checks
 * every submission). Blocking asks for a note and cancelling asks for a reason in a modal dialog
 * (AC-4); other moves submit directly.
 */
export function TransitionControls({
  action,
  reference,
  version,
  status,
  allowed,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  reference: string;
  version: number;
  status: WorkOrderStatus;
  allowed: readonly WorkOrderStatus[];
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as FormState);
  const [target, setTarget] = useState<WorkOrderStatus | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const summary = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "success") dialog.current?.close();
    if (state.status === "error" && !dialog.current?.open) summary.current?.focus();
  }, [state]);

  if (allowed.length === 0) {
    return (
      <p className="text-table text-ink-secondary">
        No status changes are available to you for this work order.
      </p>
    );
  }

  const openDialog = (to: WorkOrderStatus) => {
    setTarget(to);
    dialog.current?.showModal();
  };
  const noteError = state.status === "error" ? state.fieldErrors?.note?.[0] : undefined;
  const conflict = state.code === "CONFLICT";

  return (
    <div className="flex flex-col gap-3">
      <AlertRegion
        ref={summary}
        message={
          state.status === "error" && !noteError ? (
            <>
              {state.message}{" "}
              {conflict ? (
                <a href={`/work-orders/${reference}`} className="font-semibold underline">
                  Reload
                </a>
              ) : null}
            </>
          ) : null
        }
      />
      {state.status === "success" ? (
        <p role="status" key={state.at} className="sr-only">
          {state.message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {allowed.map((to) =>
          NEEDS_NOTE.includes(to) ? (
            <Button
              key={to}
              variant="secondary"
              disabled={pending}
              onClick={() => openDialog(to)}
              aria-haspopup="dialog"
            >
              {transitionActionLabel(status, to)}
            </Button>
          ) : (
            <form key={to} action={formAction}>
              <input type="hidden" name="reference" value={reference} />
              <input type="hidden" name="version" value={version} />
              <input type="hidden" name="toStatus" value={to} />
              <Button
                type="submit"
                variant={to === "COMPLETED" ? "primary" : "secondary"}
                disabled={pending}
              >
                {transitionActionLabel(status, to)}
              </Button>
            </form>
          ),
        )}
      </div>

      <dialog
        ref={dialog}
        aria-labelledby="transition-dialog-title"
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-sheet border border-line bg-surface p-6 shadow-sheet backdrop:bg-ink/40"
        onClose={() => setTarget(null)}
      >
        {target ? (
          <form action={formAction} noValidate className="flex flex-col gap-5">
            <h2 id="transition-dialog-title" className="font-display text-h3 font-bold text-ink">
              {target === "CANCELLED"
                ? "Cancel this work order?"
                : `Move to ${STATUS_LABELS[target]}`}
            </h2>
            {target === "CANCELLED" ? (
              <p className="text-table text-ink-secondary">
                Cancelled work stays in the record and can be restored by an administrator.
              </p>
            ) : null}
            <input type="hidden" name="reference" value={reference} />
            <input type="hidden" name="version" value={version} />
            <input type="hidden" name="toStatus" value={target} />
            <TextAreaField
              label={
                target === "CANCELLED" ? "Reason for cancelling" : "What is blocking this work?"
              }
              name="note"
              required
              maxLength={2000}
              rows={4}
              autoFocus
              error={noteError}
              hint="Saved to the work order's history."
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => dialog.current?.close()}>
                {target === "CANCELLED" ? "Keep work order" : "Back"}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending
                  ? "Saving…"
                  : target === "CANCELLED"
                    ? "Cancel work order"
                    : "Mark blocked"}
              </Button>
            </div>
          </form>
        ) : null}
      </dialog>
    </div>
  );
}
