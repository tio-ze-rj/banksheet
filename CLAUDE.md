# CLAUDE.md - banksheet

## What is this project

Open source CLI + web tool that parses bank/credit card statement PDFs into CSV, Excel, or JSON. 100% local, no AI, no external APIs. Community-driven plugin system.

## Decisions

- **Language:** TypeScript + Node.js, **Package manager:** npm, **License:** MIT
- **Interfaces:** CLI (primary) + local web UI (secondary)
- **No AI:** Pure regex/text parsing only
- **Monorepo:** npm workspaces (`packages/core`, `packages/cli`, `packages/web`)
- **Plugin system:** `packages/core/src/plugins/{CC}/{bank}/index.ts` (CC = ISO 3166-1 alpha-2 country code)
- **No database:** Stateless - parse and export, nothing stored

## Key Dependencies

`pdf-parse` · `exceljs` · `commander` · `express` + `multer` · `vitest`

## Docs (read as needed)

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — folder structure, core interfaces
- [docs/CLI_USAGE.md](docs/CLI_USAGE.md) — CLI commands and examples
- [docs/IMPLEMENTATION_ORDER.md](docs/IMPLEMENTATION_ORDER.md) — build sequence + reference files
- [docs/MODEL_ROUTING.md](docs/MODEL_ROUTING.md) — which model to use per task (token economy)

## Rules

1. **NEVER use `cd`** — always use absolute or relative paths from project root. `cd` wastes time and tokens.
2. **NEVER run destructive commands without asking first** — always confirm with the user before running: `rm`, `del`, `rmdir`, `unlink`, `shred`, `truncate`, `drop`, `dump`, `rsync --delete`, `git reset --hard`, `git clean`, `git push --force`, `git checkout -- .`, `git restore .`, `mv` (overwrite), `cp` (overwrite), `chmod -R`, `chown -R`, or any command that deletes, overwrites, or irreversibly modifies files/data.
3. Use ISO standards: ISO 8601 dates, ISO 4217 currency, ISO 3166 country codes
3. Amount as signed number (negative = expense, positive = income)
4. All code and docs in English
5. Each plugin is self-contained in its own folder
6. No AI, no external API calls, no telemetry
7. Follow [docs/MODEL_ROUTING.md](docs/MODEL_ROUTING.md) for subagent model selection
