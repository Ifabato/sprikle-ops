"use client";

import { useEffect } from "react";
import { loginPathFor } from "@/lib/return-path";
import { createSessionCheck, KEEPALIVE_INTERVAL_MS, SESSION_ENDPOINT } from "@/lib/session-monitor";

/**
 * Visible-tab session keepalive (not inactivity detection): checks the session on mount, when the
 * tab becomes visible again, and every 15 minutes while visible. Confirmed signed-out or inactive
 * sessions go to login; transient failures are ignored. Renders nothing.
 */
export function SessionKeepalive() {
  useEffect(() => {
    let active = true;
    const check = createSessionCheck({
      fetchSession: async () => {
        const response = await fetch(SESSION_ENDPOINT, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        const body: unknown = response.status === 200 ? await response.json() : undefined;
        return { status: response.status, body };
      },
      isVisible: () => document.visibilityState === "visible",
      onSignedOut: () => {
        if (active) {
          window.location.assign(
            loginPathFor(`${window.location.pathname}${window.location.search}`),
          );
        }
      },
    });

    void check();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    const timer = window.setInterval(() => void check(), KEEPALIVE_INTERVAL_MS);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
