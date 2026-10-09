# Third-party software and attribution

Licenses as declared by each installed package (`node_modules/<name>/package.json`, checked
2026-10-09). Versions are exact pins from `package.json`.

## Runtime dependencies

| Package                                                                     | Version       | License                                                                                                                    |
| --------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| next                                                                        | 16.3.8        | MIT                                                                                                                        |
| react, react-dom                                                            | 19.3.0        | MIT                                                                                                                        |
| better-auth                                                                 | 1.7.7         | MIT                                                                                                                        |
| @prisma/client, @prisma/adapter-pg                                          | 7.10.0        | Apache-2.0                                                                                                                 |
| pg                                                                          | 8.23.1        | MIT                                                                                                                        |
| zod                                                                         | 4.6.5         | MIT                                                                                                                        |
| lucide-react                                                                | 1.52.0        | ISC                                                                                                                        |
| @fontsource-variable/schibsted-grotesk, @fontsource-variable/jetbrains-mono | 5.3.0         | SIL Open Font License 1.1 (fonts self-hosted from the packages)                                                            |
| gsap, @gsap/react                                                           | 3.15.0, 2.1.2 | GSAP Standard "no charge" license (https://gsap.com/standard-license); used only by the development-only Brindle prototype |
| lenis                                                                       | 1.3.26        | MIT; used only by the development-only Brindle prototype                                                                   |

## Development dependencies

TypeScript, Prisma CLI, Playwright (Apache-2.0); ESLint, eslint-config-next, Prettier,
prettier-plugin-tailwindcss, Tailwind CSS, @tailwindcss/postcss, Vite, Vitest, @vitest/coverage-v8,
and the `@types/*` packages (MIT).

## Vendored source code (Brindle prototype, development only)

`src/app/prototypes/brindle/vendor/` contains modified copies of three components. Each file
starts with a header naming its source, license, and modifications; full provenance (commits, file
hashes) is in `src/app/prototypes/brindle/vendor/PROVENANCE.md`.

| Component          | Source                                               | License                                                                                                                                      |
| ------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Threads, SplitText | React Bits (https://github.com/DavidHDev/react-bits) | MIT + Commons Clause v1.0 (`vendor/LICENSE-react-bits.md`): may be used inside an application; may not be sold or redistributed on their own |
| Shimmer Button     | Magic UI (https://github.com/magicuidesign/magicui)  | MIT (`vendor/LICENSE-magicui.md`)                                                                                                            |

The prototype routes are served only by `next dev`; production builds return 404 for
`/prototypes/*`.

## Tooling used during design work (not part of the application)

Impeccable (design review tool) and the vendored "taste" skills under `.claude/skills/` (MIT, with
`SOURCE.md`) were used while developing; they are not imported by the application.
