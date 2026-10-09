# Vendored component provenance (Brindle prototype)

Recorded before copying, 2026-10-09. Each vendored file starts with a header that repeats its
source, license notice, and modifications.

## React Bits: Threads

- Repository: https://github.com/DavidHDev/react-bits (commit `d86fccbd477786f94ca7eb891fbe0ec039d3cd3b`, 2026-10-09)
- Source file: `src/ts-tailwind/Backgrounds/Threads/Threads.tsx` (TypeScript + Tailwind variant), 586 lines, sha256 prefix `f9da44441e10dbb3`
- Live demo: https://reactbits.dev/backgrounds/threads
- Imports: `react` only. Rendering: raw WebGL2 (`canvas.getContext('webgl2')`); renders nothing when WebGL2 is unavailable (the page provides its own static fallback).
- License: MIT + Commons Clause License Condition v1.0, Copyright (c) 2026 David Haz (full text in `LICENSE-react-bits.md`). Use inside an application is permitted; the components may not be sold, sublicensed, or redistributed on their own.
- Planned modifications: Brindle colors and parameters; `paused` driven by the GSAP timeline so the strands move only during the entrance, the scroll transformation, and a selection; a public time/progress hook if needed for scroll-linking. Each change is marked in the file.

## React Bits: SplitText

- Repository: same commit as above
- Source file: `src/ts-tailwind/TextAnimations/SplitText/SplitText.tsx`, 179 lines, sha256 prefix `f740e4b939c2ed1f`
- Live demo: https://reactbits.dev/text-animations/split-text
- Imports: `react`, `gsap`, `gsap/ScrollTrigger`, `gsap/SplitText`, `@gsap/react` (approved packages)
- License: as above
- Planned modifications: reduced-motion handling (render the final state with no animation); integration with the hero's GSAP timeline where needed. Marked in the file.

## Magic UI: Shimmer Button (listed on 21st.dev by Dillion Verma)

- Repository: https://github.com/magicuidesign/magicui (commit `cdb348cb4c72a9b54b554d8617801e479fbc8714`, 2026-10-05)
- Source file: `apps/www/registry/magicui/shimmer-button.tsx`, 96 lines, sha256 prefix `c85ffda63ba086d2`; keyframes from `apps/www/registry/registry-ui.ts` (`shimmer-slide`, `spin-around`)
- Live demos: https://magicui.design/docs/components/shimmer-button and https://21st.dev/community/components/dillionverma/shimmer-button
- Obtained from the MIT upstream repository (Option A): no 21st.dev account, API key, paid plan, or shadcn CLI.
- Imports: `react`, `cn` from `@/lib/utils` (replaced by a local helper; no new package)
- License: MIT, Copyright (c) Magic UI (full text in `LICENSE-magicui.md`)
- Planned modifications: the two infinite animations become a single pass on entrance and on hover/focus (no endless loop); Brindle colors. Used only if it improves the composition.
