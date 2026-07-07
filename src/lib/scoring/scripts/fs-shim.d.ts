/**
 * Minimal ambient typing for the two node:fs functions used by the scoring
 * dev tooling (scripts/generate-golden.ts, golden.test.ts). The repo
 * deliberately keeps tsconfig `types` browser-only (["vite/client"]), so
 * @types/node module declarations are not in the program even though the
 * package is installed. Runtime is unaffected — vitest/tsx run on Node.
 *
 * If "node" is ever added to tsconfig `types`, delete this shim.
 */

declare module 'node:fs' {
  export function readFileSync(path: string | URL, encoding: 'utf-8'): string
  export function writeFileSync(
    path: string | URL,
    data: string,
    encoding: 'utf-8',
  ): void
}
