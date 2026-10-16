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
- **L11. (superseded 10-16 by L14) The Hetzner token is fine-grained → it CANNOT open PRs on storytold/gridcraft** (REST and
  GraphQL both 403 "Resource not accessible by personal access token"). It can read upstream and
  write the user's own repos. Until a PR-capable credential exists, a loop ends at "branch pushed"
  and records a compare link (`https://github.com/storytold/gridcraft/compare/main...jonathanwxh-cell:gridcraft:<branch>?expand=1`)
  in the ledger. **Never build more than 2 pushed-but-unopened branches**; tend and wait instead.
- **L12. Verify every "fails before" claim by actually running it.** Loop 1's first before-run was
  cut short by ENOSPC; re-running in a throwaway worktree (upstream code + only the new tests)
  turned a guess into evidence (4/5 fail with the exact symptoms).
- **L13. Gate timings (4 vCPU, lean):** cold ~18 min, warm re-run ~9 min; cache steady at 4.2 GB.
- **L14. Classic token installed 10-16 in gh `hosts.yml`, but the login env's fine-grained
  `GH_TOKEN` still wins.** Always run PR writes as `env -u GH_TOKEN -u GITHUB_TOKEN gh …` on the
  box. The token has very broad scopes (incl. delete_repo, admin:org): use it ONLY for
  `gh pr create` / `gh pr comment` / `gh pr edit` on storytold/gridcraft PRs, nothing else.
- **L15. Waiting costs a merge, not a rebuild.** #1458 waited ~8 h for a token; main moved 2
  commits (one touching formula tests). `git merge upstream/main` was clean and the warm gate
  took 5m46s. Always merge + re-gate before opening a branch that has waited.
- **L16. Upstream CI queues ~50 min before an 8-min run** (#1595, 10-16 00:22→01:21). Check CI
  ~60–75 min after opening, not 15; a QUEUED check is not a failure. The next loop's tend step
  is the safety net.
