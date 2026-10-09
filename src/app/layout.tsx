import type { Metadata } from "next";
import { displayFont, monoFont } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Sprikle Ops — work orders with risk you can see",
    template: "%s · Sprikle Ops",
  },
  description:
    "Sprikle Ops (in development) gives small service businesses one accountable record for every work order, with due-date risk derived from the record.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${monoFont.variable}`}>
      <body className="min-h-dvh font-sans text-body antialiased">
        <a
          href="#main-content"
          className="sr-only rounded-control bg-surface px-4 py-3 text-table font-semibold text-ink shadow-sheet focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
