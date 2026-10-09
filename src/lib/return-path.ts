// Safe post-login return paths. Only same-site paths inside the protected application areas are
// allowed; anything else (external URLs, protocol-relative or backslash tricks, encoded slashes,
// control characters, path traversal out of the allowed areas) falls back to the dashboard.

export const DEFAULT_RETURN_PATH = "/dashboard";

const ALLOWED_AREAS = ["/dashboard", "/work-orders", "/analytics", "/profile"] as const;
const MAX_LENGTH = 512;
const PARSE_BASE = "https://sprikle.invalid";

export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_LENGTH) {
    return DEFAULT_RETURN_PATH;
  }
  // Must be a root-relative path: not "//host", and no backslashes, control characters, or
  // percent-encoded slashes/backslashes that a browser or server could reinterpret.
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(value) ||
    /%(2f|5c)/i.test(value)
  ) {
    return DEFAULT_RETURN_PATH;
  }

  let url: URL;
  try {
    url = new URL(value, PARSE_BASE);
  } catch {
    return DEFAULT_RETURN_PATH;
  }
  if (url.origin !== PARSE_BASE) {
    return DEFAULT_RETURN_PATH;
  }

  // The normalized path ("/dashboard/../login" → "/login") must stay inside an allowed area.
  const path = url.pathname;
  const allowed = ALLOWED_AREAS.some((area) => path === area || path.startsWith(`${area}/`));
  return allowed ? `${path}${url.search}` : DEFAULT_RETURN_PATH;
}

/** Login URL that returns the user to a safe path afterwards. */
export function loginPathFor(returnTo: unknown): `/login?next=${string}` {
  return `/login?next=${encodeURIComponent(safeReturnPath(returnTo))}`;
}
