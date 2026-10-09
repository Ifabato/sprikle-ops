"use server";

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { formatReference, parseReference } from "@/domain/reference";
import { getDb } from "@/server/db";
import type { FieldErrors, ServiceErrorCode } from "@/server/services/result";
import {
  addComment,
  createWorkOrder,
  editWorkOrder,
  transitionWorkOrder,
} from "@/server/services/work-orders";
import { getActor } from "@/server/session";

// Server Actions for the work-order UI. Thin adapters over the same services as /api/v1: every
// action resolves the actor from the verified session itself (render-time gating is not a
// security boundary), and Next.js rejects cross-origin action requests.

export interface FormState {
  readonly status: "idle" | "error" | "success";
  readonly code?: ServiceErrorCode;
  readonly message?: string;
  readonly fieldErrors?: FieldErrors;
  /** Submitted values echoed back so a failed form keeps what the user typed (AC-2). */
  readonly values?: Readonly<Record<string, string>>;
  /** Changes on every submission so success messages are re-announced. */
  readonly at?: number;
}

function text(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" ? value : undefined;
}

function values(form: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) result[key] = value;
  }
  return result;
}

/** Plain "is required" wording for required controls left empty (instead of format errors). */
const REQUIRED_LABELS: Readonly<Record<string, string>> = {
  title: "Title",
  description: "Description",
  serviceAreaId: "Service area",
  dueDate: "Due date",
  body: "Comment",
  note: "A note",
};

function friendlier(fieldErrors: FieldErrors | undefined, form: FormData): FieldErrors | undefined {
  if (!fieldErrors) return undefined;
  const result: Record<string, readonly string[]> = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    const label = REQUIRED_LABELS[field];
    const empty = (text(form, field) ?? "").trim() === "";
    result[field] = label && empty ? [`${label} is required.`] : messages;
  }
  return result;
}

function errorState(
  error: { code: ServiceErrorCode; message: string; fieldErrors?: FieldErrors },
  form: FormData,
): FormState {
  return {
    status: "error",
    code: error.code,
    message: error.message,
    fieldErrors: friendlier(error.fieldErrors, form),
    values: values(form),
    at: Date.now(),
  };
}

function referenceNumber(form: FormData): number | null {
  const parsed = parseReference(text(form, "reference") ?? "");
  return parsed.ok ? parsed.value.number : null;
}

const NOT_FOUND: FormState = {
  status: "error",
  code: "NOT_FOUND",
  message: "Work order not found.",
};

async function actor() {
  return getActor(await headers());
}

export async function createWorkOrderAction(_: FormState, form: FormData): Promise<FormState> {
  const assignee = text(form, "assigneeId");
  const result = await createWorkOrder(
    getDb(),
    await actor(),
    {
      title: text(form, "title"),
      description: text(form, "description"),
      serviceAreaId: text(form, "serviceAreaId"),
      priority: text(form, "priority"),
      dueDate: text(form, "dueDate"),
      ...(assignee ? { assigneeId: assignee } : {}),
    },
    new Date(),
  );
  if (!result.ok) return errorState(result, form);
  redirect(`/work-orders/${result.data.reference}?notice=created` as Route);
}

export async function editWorkOrderAction(_: FormState, form: FormData): Promise<FormState> {
  const number = referenceNumber(form);
  if (number === null) return NOT_FOUND;
  const assignee = text(form, "assigneeId");
  const result = await editWorkOrder(
    getDb(),
    await actor(),
    number,
    {
      version: Number(text(form, "version")),
      title: text(form, "title"),
      description: text(form, "description"),
      serviceAreaId: text(form, "serviceAreaId"),
      priority: text(form, "priority"),
      dueDate: text(form, "dueDate"),
      assigneeId: assignee === "" ? null : assignee,
    },
    new Date(),
  );
  if (!result.ok) return errorState(result, form);
  if (result.data.kind === "unchanged") {
    return {
      status: "success",
      message: "No changes to save.",
      values: values(form),
      at: Date.now(),
    };
  }
  redirect(`/work-orders/${formatReference(number)}?notice=updated` as Route);
}

export async function transitionAction(_: FormState, form: FormData): Promise<FormState> {
  const number = referenceNumber(form);
  if (number === null) return NOT_FOUND;
  const note = text(form, "note")?.trim();
  const result = await transitionWorkOrder(
    getDb(),
    await actor(),
    number,
    {
      version: Number(text(form, "version")),
      toStatus: text(form, "toStatus"),
      ...(note ? { note } : {}),
    },
    new Date(),
  );
  if (!result.ok) return errorState(result, form);
  refresh();
  return { status: "success", message: `Status updated.`, at: Date.now() };
}

export async function addCommentAction(_: FormState, form: FormData): Promise<FormState> {
  const number = referenceNumber(form);
  if (number === null) return NOT_FOUND;
  const result = await addComment(
    getDb(),
    await actor(),
    number,
    { body: text(form, "body") },
    new Date(),
  );
  if (!result.ok) return errorState(result, form);
  refresh();
  return { status: "success", message: "Comment added.", at: Date.now() };
}
