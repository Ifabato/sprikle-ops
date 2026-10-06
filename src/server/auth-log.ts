// Sanitized logging for Better Auth. Better Auth passes extra arguments (objects, errors,
// request data) to its logger; those are dropped entirely, and the message itself is
// scrubbed of anything that could be a credential before it is written.

type LogLevel = "debug" | "info" | "warn" | "error";

const MAX_MESSAGE_LENGTH = 300;

const REDACTIONS: [RegExp, string][] = [
  // Connection strings and any URL carrying userinfo (user:password@host).
  [/[a-z][a-z0-9+.-]*:\/\/[^\s/@]+@[^\s]+/gi, "[redacted-url]"],
  // Email addresses (account identifiers).
  [/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[redacted-email]"],
  // Long opaque values: session tokens, secrets, hashes, signatures.
  [/[A-Za-z0-9+/_=.:-]{24,}/g, "[redacted-value]"],
];

export function sanitizeAuthLogMessage(message: unknown): string {
  let text = typeof message === "string" ? message : "(non-text log message)";
  for (const [pattern, replacement] of REDACTIONS) {
    text = text.replace(pattern, replacement);
  }
  // Strip control characters so log lines cannot be forged.
  text = text.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  return text.length > MAX_MESSAGE_LENGTH ? `${text.slice(0, MAX_MESSAGE_LENGTH)}…` : text;
}

/** Better Auth `logger.log` implementation: level + sanitized message only. */
export function logAuthEvent(level: LogLevel, message: string): void {
  const line = `[auth] ${sanitizeAuthLogMessage(message)}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
