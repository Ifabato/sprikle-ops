"use client";

import Link from "next/link";
import type { Route } from "next";
import { useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/app/(app)/work-orders/actions";
import { PRIORITIES } from "@/domain/enums";
import { PRIORITY_LABELS } from "@/lib/labels";
import { AlertRegion } from "@/components/ui/alert";
import { Button, BUTTON_BASE, BUTTON_VARIANTS } from "@/components/ui/button";
import { Field, SelectField, TextAreaField } from "@/components/ui/field";

export interface WorkOrderFormValues {
  readonly title: string;
  readonly description: string;
  readonly serviceAreaId: string;
  readonly priority: string;
  readonly dueDate: string;
  readonly assigneeId: string;
}

interface Option {
  readonly id: string;
  readonly name: string;
}

/**
 * Create and edit form for administrators. Server-side validation is authoritative; on failure the
 * error summary receives focus, each field shows its own message, and typed values are kept.
 */
export function WorkOrderForm({
  action,
  initial,
  serviceAreas,
  assignees,
  submitLabel,
  cancelHref,
  minDueDate,
  reference,
  version,
  allowUnassign = true,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  initial: WorkOrderFormValues;
  serviceAreas: readonly Option[];
  assignees: readonly Option[];
  submitLabel: string;
  cancelHref: Route;
  /** Earliest selectable due date (today in New York) for new due dates. */
  minDueDate?: string;
  reference?: string;
  version?: number;
  /** Unassigning is only allowed while a work order is OPEN. */
  allowUnassign?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as FormState);
  const summary = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "error") summary.current?.focus();
  }, [state]);

  const values = (state.values ?? initial) as Partial<WorkOrderFormValues>;
  const errors = state.fieldErrors ?? {};
  const first = (name: string) => errors[name]?.[0];
  const formError = state.status === "error" ? (state.message ?? null) : null;

  return (
    // Keyed by submission so a failed submit re-renders with the values that were sent.
    <form
      key={state.at ?? 0}
      action={formAction}
      noValidate
      className="flex max-w-2xl flex-col gap-6"
    >
      <AlertRegion ref={summary} message={formError ?? null} />
      {state.status === "success" && state.message ? (
        <p role="status" className="text-table font-semibold text-ink">
          {state.message}
        </p>
      ) : null}
      {reference ? <input type="hidden" name="reference" value={reference} /> : null}
      {version !== undefined ? <input type="hidden" name="version" value={version} /> : null}

      <Field
        label="Title"
        name="title"
        required
        maxLength={120}
        defaultValue={values.title}
        hint="3 to 120 characters."
        error={first("title")}
      />
      <TextAreaField
        label="Description"
        name="description"
        required
        maxLength={5000}
        rows={5}
        defaultValue={values.description}
        error={first("description")}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <SelectField
          label="Service area"
          name="serviceAreaId"
          required
          defaultValue={values.serviceAreaId}
          error={first("serviceAreaId")}
        >
          <option value="">Choose a service area</option>
          {serviceAreas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Priority"
          name="priority"
          required
          defaultValue={values.priority}
          error={first("priority")}
        >
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_LABELS[priority]}
            </option>
          ))}
        </SelectField>
        <Field
          label="Due date"
          name="dueDate"
          type="date"
          required
          min={minDueDate}
          defaultValue={values.dueDate}
          hint="Due by the end of this day, New York time."
          error={first("dueDate")}
        />
        <SelectField
          label="Assignee"
          name="assigneeId"
          defaultValue={values.assigneeId}
          hint={
            allowUnassign
              ? "Optional while the work order is open."
              : "Required once work has started."
          }
          error={first("assigneeId")}
        >
          {allowUnassign ? <option value="">Unassigned</option> : null}
          {assignees.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Link href={cancelHref} className={`${BUTTON_BASE} ${BUTTON_VARIANTS.secondary}`}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
