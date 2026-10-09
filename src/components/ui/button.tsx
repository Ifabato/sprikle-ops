import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "inverse";

/** Shared button styles; also used by links that look like buttons. */
export const BUTTON_VARIANTS: Record<Variant, string> = {
  primary: "bg-action text-white hover:bg-action-hover disabled:hover:bg-action",
  secondary: "border border-line-control bg-surface text-ink hover:bg-surface-sunken",
  inverse: "bg-white text-ink hover:bg-surface-sunken",
};

export const BUTTON_BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-5 text-table font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60";

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
