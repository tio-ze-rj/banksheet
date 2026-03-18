# Model Routing (Token Economy)

Use the cheapest model that can handle each task:

| Task | Model | Why |
|------|-------|-----|
| File search, glob, grep, codebase exploration | **haiku** | Simple pattern matching |
| Writing boilerplate, types, interfaces | **haiku** | Mechanical, well-defined output |
| Writing tests | **haiku** | Repetitive structure, clear patterns |
| Single-file edits, small bug fixes | **haiku** | Low complexity |
| Plugin scaffolding from template | **haiku** | Copy + adapt |
| Git operations, commit messages | **haiku** | Formulaic |
| Multi-file refactoring | **sonnet** | Needs cross-file context |
| New plugin implementation (regex/parsing logic) | **sonnet** | Moderate complexity |
| CLI command implementation | **sonnet** | Integration logic |
| Code review | **sonnet** | Needs judgment |
| Architecture decisions, complex debugging | **opus** | Needs deep reasoning |
| Planning sessions, design docs | **opus** | Creative + strategic |

## Rules

- Default to **haiku** for subagents unless the task clearly needs more
- Use **sonnet** for implementation work that touches 2+ files
- Reserve **opus** for planning, debugging, and architecture only
- Always set `model` parameter on Agent tool calls
