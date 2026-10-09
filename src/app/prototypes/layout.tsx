import type { Metadata } from "next";
import { notFound } from "next/navigation";

// LOCAL DESIGN EXPERIMENT (not part of the product). /prototypes/brindle is a marketing-hero study
// kept for reference; it uses illustrative sample data only. Served by `pnpm dev` alone: production
// builds return 404 for every /prototypes route. See src/app/prototypes/README.md.
export const metadata: Metadata = {
  title: { absolute: "Brindle design experiment" },
  robots: { index: false, follow: false },
};

export default function PrototypesLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}
