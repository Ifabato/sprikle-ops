// Public contact destination for the landing page's "Request a demo" action.
//
// To enable it, set CONTACT_DESTINATION to the exact public address the owner supplied, e.g.
//   "mailto:name@example.com"  or  "https://example.com/contact"
// Until then it is null and the page shows non-clickable "Contact details coming soon" copy.
// Only mailto: and https: destinations are accepted; anything else is treated as not configured.
export const CONTACT_DESTINATION: string | null = null;

export interface ContactLink {
  readonly href: string;
  /** Human-readable destination shown next to the action, e.g. the email address or host. */
  readonly display: string;
  readonly kind: "email" | "web";
}

const EMAIL = /^[^\s@/?#]+@[^\s@/?#]+\.[^\s@/?#]+$/;

/** Validates a configured destination; null means "not configured" (never a broken link). */
export function resolveContact(destination: string | null): ContactLink | null {
  if (!destination) return null;
  const value = destination.trim();
  if (value.toLowerCase().startsWith("mailto:")) {
    const address = value.slice("mailto:".length);
    if (!EMAIL.test(address)) return null;
    return { href: `mailto:${address}`, display: address, kind: "email" };
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) {
    return null;
  }
  return { href: url.toString(), display: url.hostname.replace(/^www\./, ""), kind: "web" };
}

export const CONTACT: ContactLink | null = resolveContact(CONTACT_DESTINATION);
