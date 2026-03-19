# Implementation Order

## Phase 1 — Done

1. ~~Monorepo scaffolding (npm workspaces)~~
2. ~~Core types (`packages/core/src/types.ts`)~~
3. ~~Itaú Cartão plugin (`packages/core/src/plugins/itau-cartao/`)~~
4. ~~Parser orchestrator (`packages/core/src/parser.ts`)~~
5. ~~Plugin registry + auto-detection (`packages/core/src/plugins/index.ts`, `detector.ts`)~~
6. ~~Exporters: CSV, JSON, Excel (`packages/core/src/exporter.ts`)~~
7. ~~CLI with parse + list commands (`packages/cli/src/`)~~
8. ~~Unit, integration, and E2E tests (130 tests, core 100% coverage)~~

## Phase 2 — Done

9. ~~Additional bank plugins (Bradesco, C6, Inter, Nubank — all BR credit cards)~~
10. ~~Plugin template + CONTRIBUTING.md + PLUGIN_GUIDE.md~~
11. ~~Web UI (`packages/web/` — Express backend + HTML/JS frontend)~~
12. ~~README.md with badges, logo, CI status~~
13. ~~npm publishing (`@banksheet/core`, `@banksheet/cli`)~~
14. ~~GitHub Actions CI (Node 18/20/22)~~

## Reference Files

The `reference/` folder contains the original statement parsing code from perasapi (private project):

- `statement.controller.ts` — Main parsing logic: `limparTexto()` (ported as Itaú Cartão plugin)
- `statement.helpers.ts` — PDF-to-image helper (future Vision support reference)
- `routes.ts` — Express route (reference for web server)
- `2026-03-17-banksheet-brainstorm.md` — Full brainstorm document with all decisions
