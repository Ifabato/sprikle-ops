"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/(app)/work-orders/actions";
import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/field";

/** Adds an immutable comment (AC-6). Clears after a successful post and announces the result. */
export function CommentForm({
  action,
  reference,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  reference: string;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as FormState);
  const error =
    state.status === "error" ? (state.fieldErrors?.body?.[0] ?? state.message) : undefined;
  return (
    <form
      key={state.status === "success" ? state.at : "draft"}
      action={formAction}
      noValidate
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="reference" value={reference} />
      <TextAreaField
        label="Add a comment"
        name="body"
        required
        maxLength={2000}
        rows={3}
        defaultValue={state.status === "error" ? state.values?.body : ""}
        hint="Comments cannot be edited or deleted."
        error={error}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Posting…" : "Post comment"}
        </Button>
        <p role="status" className="text-table text-ink-secondary">
          {state.status === "success" ? state.message : ""}
        </p>
      </div>
    </form>
  );
}
