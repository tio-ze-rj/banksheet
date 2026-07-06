#!/usr/bin/env bash
# Point git at the versioned hooks in .githooks/. Run once after cloning.
set -euo pipefail
repo_root=$(git rev-parse --show-toplevel)
git config core.hooksPath .githooks
chmod +x "$repo_root/.githooks/pre-commit"
echo "✓ core.hooksPath set to .githooks — pre-commit hook active."
