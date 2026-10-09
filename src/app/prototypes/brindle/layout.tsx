import { SmoothScroll } from "./smooth-scroll";

// Brindle prototype layout (temporary, development only). Scopes Lenis to this route.
export default function BrindleLayout({ children }: { children: React.ReactNode }) {
  return <SmoothScroll>{children}</SmoothScroll>;
}
