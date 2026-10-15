# Lessons

Newest evidence wins. Each lesson: the rule, then *why* (evidence). Edit or delete lessons that
turn out wrong. Fold stable ones into PLAYBOOK.md every ~5 loops.

## Upstream & maintainers
- **L1. Maintainer merges in bursts and fixes conflicts himself.** `echelon` (Brandon Thomas)
  merges external PRs with "Merge main into #N" commits and small fix-ups (rustfmt, unused
  imports). *Why:* upstream log 2026-10-12..15. → Keep PRs conflict-light (small, one concern),
  and never leave a red PR: he fixes conflicts, not failures.
- **L2. What gets merged: small, issue-numbered bug fixes with tests.** Branch names like
  `fix/edate-eomonth-1900`, `issue-564`, `fix/multi-row-delete-758` dominate the merged list.
  *Why:* ~350 merged PRs in upstream history; top external contributors (marcoarnulfo, vangel76,
  MarekSpodBiedry) ship many tiny fixes.
- **L3. Our merged PR #712 is the template for PR bodies.** Clear user-visible problem, scope
  limits, failing-before/passing-after counts, gate result, honest "not verified in Excel".
- **L4. Meta-tooling PRs wait.** Our 4 "Compare … in XLSX fidelity checks" PRs (#1075, #1081,
  #1093, #1094) and #918 are green + mergeable but unmerged after 2 days, while user-facing
  bug fixes landed. → Prefer user-visible bug fixes from issues over checker/tooling work.
- **L5. Issues filed with a measured table + Cause + Fix ideas + Tests sections** (e.g. #1458)
  are the best tasks: the spec, the rule and the test list are already written.
- **L6. The `ticket-craft` bot asks to split `multiple issues` tickets.** → Fix one listed
  problem per PR and say "Fixes part of #N".

## Environment
- **L7. Upstream API only via Hetzner `github_api`** (token = jonathanwxh-cell). The session's
  GitHub MCP/proxy refuses storytold/gridcraft. GraphQL keeps responses small.
- **L8. Cold container needs** `rustup target add wasm32-unknown-unknown` and the GTK/X11/Wayland
  `-dev` packages before `cargo xtask ci` can pass the wasm and UI-crate steps.

## User directives (highest priority)
- **D1. Contribute to storytold/gridcraft, not the fork.** The fork only hosts PR head branches.
- **D2. Storage must not grow between loops.** One shared target dir, worktrees removed after
  push, 12 GB build-cache cap, fork branches deleted after merge/close, state files pruned.

## Build & disk
- **L9. Full gate on default debug profile = 26 GB+ → ENOSPC during `test`.** Loop 1's baseline
  died at the test step with "No space left on device" after 21 min. Build lean (no incremental,
  no debug info), one shared target dir, and check `df -h` before starting the gate.
- **L10. Remote branch deletion is denied by the session's auto-mode policy** ("Git Destructive").
  Don't retry or work around it; list prunable branches for the user instead.
