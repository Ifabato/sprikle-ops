import { ArrowUpRight, Clock } from "lucide-react";
import { BUTTON_BASE, BUTTON_VARIANTS } from "@/components/ui/button";
import { CONTACT } from "@/config/contact";

/**
 * "Request a demo" when a contact destination is configured (src/config/contact.ts); until then an
 * honest, non-clickable notice. Never a broken link or a form that pretends to submit.
 */
export function ContactAction({ onDark = false }: { onDark?: boolean }) {
  if (CONTACT) {
    return (
      <a
        href={CONTACT.href}
        {...(CONTACT.kind === "web" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={`${BUTTON_BASE} ${onDark ? BUTTON_VARIANTS.inverse : BUTTON_VARIANTS.primary}`}
      >
        Request a demo
        <ArrowUpRight aria-hidden="true" className="size-4" />
        <span className="sr-only">
          {CONTACT.kind === "email"
            ? ` by email to ${CONTACT.display}`
            : ` on ${CONTACT.display} (opens in a new tab)`}
        </span>
      </a>
    );
  }
  return (
    <p
      className={`inline-flex min-h-11 items-center gap-2 rounded-control border border-dashed px-4 text-table font-medium ${
        onDark ? "border-rail-line text-rail-text" : "border-line-control text-ink-secondary"
      }`}
    >
      <Clock aria-hidden="true" className="size-4" />
      Contact details coming soon
    </p>
  );
}
