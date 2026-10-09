import { CircleAlert } from "lucide-react";
import {
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

/**
 * Labeled input. Required is marked in text; hints and inline errors (with an icon) are linked
 * with aria-describedby, and an error sets aria-invalid.
 */
export function Field({
  label,
  hint,
  error,
  required,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label font-semibold text-ink">
        {label}
        {required ? <span className="font-normal text-ink-secondary"> (required)</span> : null}
      </label>
      <input
        id={id}
        required={required}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className="min-h-12 rounded-control border border-line-control bg-surface px-3.5 text-body text-ink transition-colors duration-150 placeholder:text-ink-secondary hover:border-ink aria-invalid:border-danger"
        {...input}
      />
      {hint ? (
        <p id={hintId} className="text-label text-ink-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-center gap-1.5 text-label text-danger">
          <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL_CLASS =
  "rounded-control border border-line-control bg-surface px-3.5 text-body text-ink transition-colors duration-150 placeholder:text-ink-secondary hover:border-ink aria-invalid:border-danger";

function FieldFrame({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label font-semibold text-ink">
        {label}
        {required ? <span className="font-normal text-ink-secondary"> (required)</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-label text-ink-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-label text-danger">
          <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string): string | undefined {
  return (
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") ||
    undefined
  );
}

/** Labeled select with the same hint/error wiring as Field. */
export function SelectField({
  label,
  hint,
  error,
  required,
  children,
  ...select
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; error?: string }) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} required={required} hint={hint} error={error}>
      <select
        id={id}
        required={required}
        aria-describedby={describedBy(id, hint, error)}
        aria-invalid={error ? true : undefined}
        className={`min-h-12 ${CONTROL_CLASS}`}
        {...select}
      >
        {children}
      </select>
    </FieldFrame>
  );
}

/** Labeled multi-line input with the same hint/error wiring as Field. */
export function TextAreaField({
  label,
  hint,
  error,
  required,
  ...textarea
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string }) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} required={required} hint={hint} error={error}>
      <textarea
        id={id}
        required={required}
        aria-describedby={describedBy(id, hint, error)}
        aria-invalid={error ? true : undefined}
        className={`min-h-28 py-3 ${CONTROL_CLASS}`}
        {...textarea}
      />
    </FieldFrame>
  );
}
