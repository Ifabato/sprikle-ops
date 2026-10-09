import Link from "next/link";
import { ContactAction } from "./contact-action";

export function ContactSection() {
  return (
    <section
      id="contact"
      aria-labelledby="contact-heading"
      className="on-rail scroll-mt-4 border-t border-rail-line bg-rail-deep text-rail-text"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-20 sm:px-6 md:flex-row md:items-end md:justify-between lg:px-8 lg:py-24">
        <div className="flex max-w-xl flex-col gap-4">
          <h2
            id="contact-heading"
            className="font-display text-display-2 font-extrabold tracking-display text-balance text-white"
          >
            Want to see it on your own work?
          </h2>
          <p className="text-body text-rail-muted">
            Brindle is in development. Demo requests open once contact details are published here.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3">
          <ContactAction onDark />
          <p className="text-table text-rail-muted">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-white underline decoration-rail-muted decoration-2 underline-offset-4"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
