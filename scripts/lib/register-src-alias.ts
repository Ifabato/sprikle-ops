// Lets plain `node` (built-in type stripping, no extra dependency) run scripts that import the
// application's services. It resolves the `@/` alias to `src/` and the extensionless relative
// imports the Next.js code base uses ("./enums" → "./enums.ts"). Loaded with
// `node --import ./scripts/lib/register-src-alias.ts <script>`.
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const SRC = pathToFileURL(`${process.cwd()}/src/`);

function isMissing(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "ERR_MODULE_NOT_FOUND" || code === "ERR_UNSUPPORTED_DIR_IMPORT";
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const mapped = specifier.startsWith("@/") ? new URL(specifier.slice(2), SRC).href : specifier;
    const local = mapped !== specifier || mapped.startsWith(".") || mapped.startsWith("file:");
    try {
      return nextResolve(mapped, context);
    } catch (error) {
      if (!local || !isMissing(error)) throw error;
      for (const candidate of [`${mapped}.ts`, `${mapped}/index.ts`]) {
        try {
          return nextResolve(candidate, context);
        } catch (retry) {
          if (!isMissing(retry)) throw retry;
        }
      }
      throw error;
    }
  },
});
