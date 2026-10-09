// Visible-tab session keepalive logic (Phase 4B). This is NOT user-inactivity detection: it
// periodically asks the auth handler for the session while the tab is visible, which lets Better
// Auth roll the 8-hour expiry forward (sessions older than one hour are extended). Pure and
// dependency-injected so every branch is unit-testable without a browser.

export const KEEPALIVE_INTERVAL_MS = 15 * 60 * 1000;
export const SESSION_ENDPOINT = "/api/auth/get-session";

export type SessionCheckOutcome =
  /** Session exists and the account is active. */
  | "valid"
  /** Confirmed: no session (expired or signed out) or the account is inactive. */
  | "signed-out"
  /** Could not confirm either way (network error, 5xx, 429, unexpected body). Do nothing. */
  | "transient";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Classifies a GET /api/auth/get-session response. Better Auth answers 200 with `null` when there
 * is no valid session, and 200 with the user (including isActive) otherwise. Only a confirmed
 * signed-out answer may send the user to login; anything uncertain is transient.
 */
export function classifySessionResponse(status: number, body: unknown): SessionCheckOutcome {
  if (status === 401) {
    return "signed-out";
  }
  if (status !== 200) {
    return "transient";
  }
  if (body === null) {
    return "signed-out";
  }
  if (isRecord(body) && isRecord(body.user)) {
    if (body.user.isActive === true) return "valid";
    if (body.user.isActive === false) return "signed-out";
  }
  return "transient";
}

export interface SessionMonitorDependencies {
  fetchSession: () => Promise<{ status: number; body: unknown }>;
  isVisible: () => boolean;
  onSignedOut: () => void;
}

/**
 * Returns a check function that never overlaps itself, skips hidden tabs, swallows transient
 * failures, and calls onSignedOut only for a confirmed signed-out or inactive session.
 */
export function createSessionCheck(
  deps: SessionMonitorDependencies,
): () => Promise<SessionCheckOutcome | "skipped"> {
  let inFlight = false;
  return async () => {
    if (inFlight || !deps.isVisible()) {
      return "skipped";
    }
    inFlight = true;
    try {
      let outcome: SessionCheckOutcome;
      try {
        const { status, body } = await deps.fetchSession();
        outcome = classifySessionResponse(status, body);
      } catch {
        outcome = "transient";
      }
      if (outcome === "signed-out") {
        deps.onSignedOut();
      }
      return outcome;
    } finally {
      inFlight = false;
    }
  };
}
