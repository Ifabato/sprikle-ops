"use client";

import { LoaderCircle } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { AlertRegion } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

// Posts to Better Auth's HTTP endpoint (where origin checks and the sign-in limiter apply).
// Failure messages stay generic: they never reveal whether an account exists or is inactive.

const MESSAGES = {
  missing: "Enter your email and password.",
  invalid: "Email or password is incorrect.",
  rateLimited: "Too many sign-in attempts. Try again in about a minute.",
  blocked: "This sign-in request was blocked. Reload the page and try again.",
  unavailable: "Couldn't reach Brindle. Try again.",
} as const;

function messageFor(status: number): string {
  if (status === 401 || status === 400) return MESSAGES.invalid;
  if (status === 429) return MESSAGES.rateLimited;
  if (status === 403) return MESSAGES.blocked;
  return MESSAGES.unavailable;
}

interface FieldErrors {
  email?: string;
  password?: string;
}

export function LoginForm({ returnTo }: { returnTo: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const summaryRef = useRef<HTMLDivElement>(null);

  function showError(text: string, errors: FieldErrors = {}) {
    setMessage(text);
    setFieldErrors(errors);
    // The error summary receives focus (visual direction: Forms).
    requestAnimationFrame(() => summaryRef.current?.focus());
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const missing: FieldErrors = {};
    if (email.trim() === "") missing.email = "Enter your email.";
    if (password === "") missing.password = "Enter your password.";
    if (missing.email || missing.password) {
      showError(MESSAGES.missing, missing);
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setFieldErrors({});
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.ok) {
        // Full navigation so the server renders the protected page with the new session cookie.
        window.location.assign(returnTo);
        return;
      }
      setPassword("");
      showError(messageFor(response.status));
    } catch {
      showError(MESSAGES.unavailable);
    }
    setSubmitting(false);
  }

  return (
    <form noValidate onSubmit={onSubmit} aria-busy={submitting} className="flex flex-col">
      <AlertRegion ref={summaryRef} id="sign-in-message" message={message} />
      <div className="flex flex-col gap-5">
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          error={fieldErrors.email}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={fieldErrors.password}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? (
            <>
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </div>
    </form>
  );
}
