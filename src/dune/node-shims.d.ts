// Minimal ambient declarations for the small slice of Node's fs/path/url APIs that
// src/dune/theme.test.ts needs to read CSS files from disk. This project has no
// @types/node installed, and this fix wave's isolation constraint forbids installing
// new dependencies or touching package.json/tsconfig.json to add them — so these are
// declared locally, inside src/dune/, instead. Only ever imported from a Vitest test
// file, which runs under Node; never reachable from the browser build.
declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf-8"): string
}
declare module "node:path" {
  export function dirname(p: string): string
  export function join(...parts: string[]): string
}
declare module "node:url" {
  export function fileURLToPath(url: string): string
}
