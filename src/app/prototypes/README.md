# Brindle design experiment (local only)

`/prototypes/brindle` is an optional marketing-hero study: a GSAP-choreographed scene in which
"strands" for each owner weave through sample jobs and resolve into a record view. It is **not part
of the working application**; it uses illustrative sample data (`brindle/sample.ts`) and performs
no reads or writes.

- Run it: `pnpm dev`, then open http://localhost:3000/prototypes/brindle. No database or sign-in is
  needed for this page.
- Production builds (`pnpm build && pnpm start`) return 404 for every `/prototypes` route.
- Libraries used only here: `gsap`, `@gsap/react`, `lenis` (smooth scrolling scoped to this route).
- Vendored components (React Bits Threads and SplitText, Magic UI Shimmer Button) are in
  `brindle/vendor/` with their licenses and `PROVENANCE.md`.
- Motion respects `prefers-reduced-motion`; without JavaScript or WebGL the scene renders statically.
