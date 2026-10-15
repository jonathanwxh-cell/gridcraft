# GridCraft Autopilot — Playbook

One **loop** = one fresh session that tends open PRs, learns from outcomes, and (if allowed) ships
**one** small, high-quality PR to `storytold/gridcraft` from the fork `jonathanwxh-cell/gridcraft`.

State lives on the fork's orphan branch **`autopilot`** (this file, `LESSONS.md`, `LEDGER.md`).
Every loop reads all three first and writes `LESSONS.md` + `LEDGER.md` last. **LESSONS.md
overrides this playbook** where they conflict (it is newer evidence); fold durable lessons back
into this playbook every ~5 loops.

## 0. Access map (why things are wired this way)
- The session's git proxy can **push to the fork** (`origin`) and **fetch upstream** (`git remote add
  upstream https://github.com/storytold/gridcraft`).
- The session's GitHub MCP **cannot** see `storytold/gridcraft` (same repo name as the fork; only
  one can attach). Use the **Hetzner_Computer `github_api` tool** for everything upstream: it holds
  a token for `jonathanwxh-cell`. Prefer `POST /graphql` (compact) over REST (responses truncate at
  ~50 KB). Every upstream comment/PR body is authored as the user: be accurate and brief.

## 1. Setup (≈10 min, mostly the cold build)
```sh
# repo (skip if /home/user/gridcraft exists): add_repo jonathanwxh-cell/gridcraft (push) then
git clone --depth 1 https://github.com/jonathanwxh-cell/gridcraft /home/user/gridcraft
cd /home/user/gridcraft
git remote add upstream https://github.com/storytold/gridcraft
git fetch --depth 200 upstream main
git fetch origin autopilot:autopilot && git worktree add /home/user/autopilot autopilot
rustup target add wasm32-unknown-unknown
apt-get update -qq && apt-get install -y -qq --no-install-recommends pkg-config libxkbcommon-dev \
  libwayland-dev libx11-dev libxcursor-dev libxrandr-dev libxi-dev libgtk-3-dev libfontconfig1-dev libfreetype-dev
```
Start a warm-up build in the background right away (`cargo build --workspace --tests`) so the
gate later is incremental.

## 2. Tend before you build (always first)
Query all open upstream PRs by `jonathanwxh-cell` (GraphQL: state, mergeable, statusCheckRollup,
last comments/reviews). For each, in this order:
1. **Merge conflict** → in the fork branch, `git merge upstream/main` (never rebase/force-push a
   branch that has a PR), resolve, run the gate, push.
2. **CI red** → reproduce locally, fix, gate, push. Never skip/disable tests, never empty commits.
3. **Maintainer / reviewer comment** → do small asks now; reply once (as the user) with what
   changed. Larger asks: reply with a proposal, don't widen the PR.
4. **Merged / closed** → harvest: what did the maintainer change on merge ("Merge main into #N",
   fix-up commits), what did they say? Turn it into a LESSON.
Only ever comment on a PR when there is something to say. No "bump" comments.

## 3. Throttle (be a good citizen)
- **WIP cap:** at most **8** open upstream PRs by the user. At/over cap → spend the loop on
  tending, on making existing PRs easier to merge (rebasing onto conflicts early), or on
  investigation notes in LESSONS; do **not** open a new PR.
- **At most 3 new PRs per 24 h.**
- Never open a PR whose `cargo xtask ci` did not pass locally on the final commit.

## 4. Pick a task
Source: upstream issues, newest first:
`repo:storytold/gridcraft is:issue is:open -linked:pr` (GraphQL search). Score candidates:
- ✅ has a precise repro / measured table / named file+line (issues filed by the maintainers'
  measurement bots are gold); labels `priority: critical|high` first.
- ✅ fixable and **provable headlessly** (formula, functions, numfmt, xlsx, engine commands, CLI).
  UI-only work only if verifiable with the offscreen snapshot example.
- ✅ ≤ ~400 changed lines, one concern. If an issue is labelled `multiple issues`, fix **one**
  listed problem and say which in the PR (don't claim to close the issue).
- ❌ skip if any open PR mentions the issue number
  (`repo:storytold/gridcraft is:pr is:open <N>`), or a recent comment claims it, or it needs Excel,
  fonts, a real-file corpus, new assets, or a design decision.
- ❌ skip anything touching vendor assets/branding (AGENTS.md absolute rule).
Record the pick and why in the ledger before coding.

## 5. Build it right
- Branch from fresh `upstream/main`: `git checkout -B fix/<topic>-<issue> upstream/main`.
- Read `CLAUDE.md`/`AGENTS.md` rules again for the crates you touch (never-crash, layering,
  everything-is-a-command, docs timestamps).
- **Tests first:** write the regression tests, run them on unchanged code and record how many fail
  (this is the PR's evidence). Then fix. Then all pass.
- Minimal diff. No drive-by refactors. Match local style (comment density, naming).
- Update affected docs (`docs/gaps.md`, parity docs) only if the change moves a listed gap — keep
  their "Last updated" lines consistent.

## 6. Gate (must be green before push)
1. `cargo fmt --all` then `cargo xtask ci` (fmt, clippy -D warnings, tests, assets, layers, wasm,
   parity, keytips). Run it in the background and wait; it is the same gate CI runs.
2. Independent review: spawn a review subagent (or `/code-review high`) on the diff against
   `upstream/main`, with the issue text. Fix what is real; re-run the gate if code changed.
3. Re-read the diff adversarially: panics/indexing on hostile input? wasm-safe? layering? one
   concern only? did I edit generated files by hand?
4. `git fetch upstream main`; if main moved, merge it and re-run the gate.

## 7. Ship
- Commit message: `#<issue>: <imperative summary>` (+ attribution trailers from the session).
  One concern per commit; no model names in commits or PR text.
- Push to the fork: `git push -u origin <branch>`.
- Open the PR upstream via `github_api POST /repos/storytold/gridcraft/pulls`
  `{title, head:"jonathanwxh-cell:<branch>", base:"main", body, maintainer_can_modify:true}`.
- **PR body shape (modelled on merged #712):**
  1. What was wrong, from the user's point of view, with the issue link (`Fixes part of #N` unless
     it fully closes it → `Fixes #N`).
  2. What changed and the rule it follows (cite public docs/measurements in the issue).
  3. What is deliberately **not** done / follow-ups.
  4. Validation: tests added; how many failed on unchanged code; the gate result
     (`cargo xtask ci` — all gates); platform + baseline sha.
  5. Honest limits ("not checked in real Excel").
  6. One line: "Prepared with AI assistance; independently reviewed by a separate agent."
- Check CI ~15–30 min later in the same loop if time allows (GraphQL statusCheckRollup). Red →
  fix now.

## 8. Learn (always last)
Append to `LEDGER.md` (one row) and to `LESSONS.md` (only *new, evidenced* lessons; edit or
delete lessons proven wrong). Commit to the `autopilot` branch and push:
`git -C /home/user/autopilot add -A && git -C /home/user/autopilot commit -m "loop N: <summary>" && git -C /home/user/autopilot push origin autopilot`.
A loop that learned nothing still writes a ledger row.

## Stop conditions (tell the user, don't push through)
- A maintainer asks to slow down / stop AI PRs, or closes 2+ PRs unmerged with criticism → pause
  new PRs, record it, and say so in the ledger.
- Credentials/tool access broken → record and stop.
