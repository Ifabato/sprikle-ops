import localFont from "next/font/local";

// Self-hosted from the pinned @fontsource-variable packages (OFL-1.1): served from this app's own
// origin with no third-party font requests. Latin subset only; other characters fall back to the
// system stack.

export const displayFont = localFont({
  src: "../../node_modules/@fontsource-variable/schibsted-grotesk/files/schibsted-grotesk-latin-wght-normal.woff2",
  variable: "--font-schibsted",
  weight: "400 900",
  display: "swap",
  fallback: ["system-ui", "Arial", "sans-serif"],
});

export const monoFont = localFont({
  src: "../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
  variable: "--font-jetbrains",
  weight: "100 800",
  display: "swap",
  fallback: ["ui-monospace", "Menlo", "monospace"],
});
