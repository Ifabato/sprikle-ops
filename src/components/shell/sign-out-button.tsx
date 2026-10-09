"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

/**
 * Signs out through the auth handler (POST, same origin). Navigates to /login only after the
 * server confirms; a failure is shown instead of pretending the user is signed out.
 */
export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.ok) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full page load discards the client router cache that still holds signed-in pages
        window.location.assign("/login");
        return;
      }
      setFailed(true);
    } catch {
      setFailed(true);
    }
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className="flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-table font-medium text-rail-text transition-colors duration-150 hover:bg-rail-active/60 disabled:opacity-60"
      >
        <LogOut aria-hidden="true" className="size-4.5 shrink-0" />
        {pending ? "Signing out…" : "Sign out"}
      </button>
      <p role="alert" aria-live="assertive" className="px-3 text-label text-rail-text">
        {failed ? "Sign-out failed. Check your connection and try again." : ""}
      </p>
    </div>
  );
}
