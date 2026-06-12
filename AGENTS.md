# Agent Guidelines

## Project shape
- Astro 6 app deployed with the Cloudflare adapter (`astro.config.mjs`).
- Svelte 5 is used for the interactive printer UI; the main page mounts `src/components/CubePrinter.svelte` with `client:only="svelte"` from `src/pages/index.astro`.
- Runtime API route: `src/pages/api/cube.ts` proxies Cube Cobra JSON when direct browser fetch fails. Keep `export const prerender = false` for request-time execution.
- Cube Cobra API schemas used by the app are documented in `docs/cube-cobra-api-shape.md`; update that doc when changing raw API parsing or normalized printable card fields.
- TypeScript is strict via `astro/tsconfigs/strict`; Svelte component script currently uses JSDoc-style types inside plain `<script>`.

## Domain language
Use the terms in `CONTEXT.md` consistently:
- **Cube ID**: Cube Cobra identifier, not the full URL.
- **Layout**: paper size, margins, spacing, cards per page.
- **Print Selection**: loaded cards currently included in printable output.
- **Board**, **Type Line**, **Color Identity**, **Multicolor**: preserve these meanings in UI, code, and docs.

## Key implementation patterns
- `CubePrinter.svelte` is the app shell: constants, Svelte 5 runes state, derived layout/filter state, URL state, cube loading, template, and scoped CSS live together.
- Prefer Svelte 5 runes already in use: `$state`, `$derived`, `$derived.by`, `$effect`.
- URL query string is the source for shareable state. When adding options:
  1. extend `readUrlState`, `applyUrlState`, and `writeUrl`,
  2. normalize incoming values,
  3. include the value in the URL-update `$effect`,
  4. document the query parameter.
- Keep layout math in millimeters. Existing physical constants: card `63mm × 88mm`, margin `12.5mm`, cut marks `5mm`.
- Normalize external Cube Cobra data at the boundary (`normalizeCard`, `getPrintableCards`) before filtering or rendering.
- Filter functions should operate on normalized printable cards and preserve current semantics: type fragments are ANDed; tags/boards are case-insensitive selected-any checks; color identity has single-color, include-multicolor, and multicolor-only modes.
- Print behavior depends on runtime-injected `@page` CSS plus `@media print` overrides. Test both preview and browser print when changing layout or CSS.

## Commands
- Install: `npm install`
- Dev server: `npm run dev`
- Production build/type check: `npm run build`
- Preview built app: `npm run preview`

## Extension guidance
- Keep new code small and domain-named; extract helpers from `CubePrinter.svelte` only when they become independently testable or reused.
- Do not introduce client storage unless explicitly requested; preserve URL-shareable state.
- Do not bypass `/api/cube` fallback behavior; direct Cube Cobra fetch may fail due to CORS.
- Avoid editing generated/build output (`dist`, `.astro`, `.wrangler`, `node_modules`).
- Before changing docs, note that `README.md` may lag the current stack; prefer package/config/source files as implementation truth.
