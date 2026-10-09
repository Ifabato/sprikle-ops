import type { Metadata } from "next";
import { ContactSection } from "@/components/marketing/contact-section";
import { Hero } from "@/components/marketing/hero";
import { Principles } from "@/components/marketing/principles";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Workflow } from "@/components/marketing/workflow";

export const metadata: Metadata = {
  title: { absolute: "Brindle — know what's at risk before it's late" },
};

// Public landing page. Static: it reads no session (Sign in goes to /login, which forwards
// signed-in users). Everything on the sample board and activity trail is labeled sample data.
export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <Hero />
        <Workflow />
        <Principles />
        <ContactSection />
      </main>
      <SiteFooter />
    </>
  );
}
