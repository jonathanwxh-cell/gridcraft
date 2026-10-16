export const meta = {
  name: 'gridcraft-autopilot-round',
  description: 'One GridCraft autopilot round: scout upstream issues, vet top candidates, build one fix tests-first, gate, independent review, fix',
  phases: [
    { title: 'Scout', detail: 'two search angles over open upstream issues' },
    { title: 'Vet', detail: 'read the code for the top candidates; confirm headless, small, unclaimed' },
    { title: 'Build', detail: 'tests-first fix + before-evidence + lean cargo xtask ci' },
    { title: 'Review', detail: 'two independent review lenses' },
    { title: 'Fix', detail: 'apply blocking/should-fix findings and re-gate' },
  ],
}

const CTX = `
CONTEXT (shared):
- You are part of the GridCraft autopilot. Upstream repo: storytold/gridcraft (Rust spreadsheet). Local clone: /home/user/gridcraft (remote "upstream" = storytold, "origin" = the user's fork jonathanwxh-cell/gridcraft). Upstream main is at ${args.upstreamSha}.
- Playbook + lessons from earlier loops: /home/user/autopilot/PLAYBOOK.md and /home/user/autopilot/LESSONS.md. Read LESSONS.md before acting.
- Upstream GitHub reads: use the MCP tool mcp__Hetzner_Computer__github_api (load it with ToolSearch "select:mcp__Hetzner_Computer__github_api"), preferably POST /graphql. Never write to GitHub (no comments, PRs, pushes).
- The repo's CLAUDE.md rules apply (no panics/unwrap in non-test code, layering, wasm-safe, everything-is-a-command, clean-room, no assets).
- DISK IS LIMITED: any cargo command MUST run with: export CARGO_TARGET_DIR=/home/user/gridcraft/target CARGO_INCREMENTAL=0 CARGO_PROFILE_DEV_DEBUG=0 CARGO_PROFILE_TEST_DEBUG=0 . Never create another target dir. Put logs in /tmp/claude-0/-home-user/f1c70b9d-d4fd-5378-b00c-204f3387604a/scratchpad/.
- Do not delete remote branches; do not run git push.
`

const CANDIDATES = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          issue: { type: 'integer' },
          title: { type: 'string' },
          subproblem: { type: 'string', description: 'the ONE concrete problem to fix (for multi-issue tickets)' },
          crates: { type: 'array', items: { type: 'string' } },
          why: { type: 'string' },
          competingPrs: { type: 'string', description: 'result of the open-PR search for this issue number' },
          score: { type: 'integer', description: '1-10, value x feasibility x provability' },
        },
        required: ['issue', 'title', 'subproblem', 'why', 'competingPrs', 'score'],
      },
    },
  },
  required: ['candidates'],
}

phase('Scout')
const ANGLES = [
  `Angle A: issues with a MEASURED table / precise expected-vs-actual (often filed with "## Measured", "## Cause", "## Fix ideas", "## Tests" sections) in formula, functions, numfmt, calc or xlsx — prefer "priority: critical" or "priority: high".`,
  `Angle B: crash, data-loss or wrong-result bugs with an exact headless repro (gridcraft-cli / engine commands / steps.jsonl), any crate except pure UI; newest first.`,
]
const scouted = await parallel(ANGLES.map((angle, i) => () => agent(
  `${CTX}
TASK: find up to 4 candidate upstream issues for ONE small, high-quality PR.
${angle}
Search with GraphQL, e.g. search(query:"repo:storytold/gridcraft is:issue is:open -linked:pr sort:created-desc", type:ISSUE, first:50) and read bodies of promising ones.
For EACH candidate you return, you MUST run search(query:"repo:storytold/gridcraft is:pr <number>") and also check the issue's latest comments for anyone claiming it; drop it if an open PR or a claim exists.
Exclude: #1458 (already done in PR #1595), anything needing real Excel, fonts, non-Latin shaping, a real-file corpus, new assets, a UI design decision, or more than ~400 changed lines. For "multiple issues" tickets pick ONE listed problem as the subproblem.
Score honestly; prefer user-visible correctness bugs over tooling (lesson L4).`,
  { label: `scout:${i === 0 ? 'measured' : 'repro'}`, phase: 'Scout', schema: CANDIDATES })))

const seen = new Set()
const pool = scouted.filter(Boolean).flatMap(r => r.candidates)
  .filter(c => !/open pr|claimed/i.test(c.competingPrs) || /none|no open|0 /i.test(c.competingPrs))
  .sort((a, b) => b.score - a.score)
  .filter(c => (seen.has(c.issue) ? false : (seen.add(c.issue), true)))
log(`Scouts proposed ${pool.length} unique candidates: ${pool.map(c => '#' + c.issue + '(' + c.score + ')').join(', ')}`)
if (!pool.length) return { outcome: 'no-candidates' }
const top = pool.slice(0, 3)
if (pool.length > 3) log(`Vetting only the top 3; dropped: ${pool.slice(3).map(c => '#' + c.issue).join(', ')}`)

const VET = {
  type: 'object',
  properties: {
    issue: { type: 'integer' },
    feasible: { type: 'boolean' },
    reason: { type: 'string' },
    plan: { type: 'string', description: 'files/functions to change and the regression tests to add' },
    estLines: { type: 'integer' },
    headlessProvable: { type: 'boolean' },
  },
  required: ['issue', 'feasible', 'reason', 'plan', 'estLines', 'headlessProvable'],
}

phase('Vet')
const vetted = (await parallel(top.map(c => () => agent(
  `${CTX}
TASK (read-only; do not edit files, do not build): vet upstream issue #${c.issue} "${c.title}" — subproblem: ${c.subproblem}.
Read the full issue via GraphQL, then read the relevant code in /home/user/gridcraft (it is at e6b6b34; run "git -C /home/user/gridcraft diff --stat e6b6b34 upstream/main" to see what changed since, and read upstream versions with "git -C /home/user/gridcraft show upstream/main:<path>" where relevant).
Decide: is the bug real in current upstream code, fixable in <= ~400 lines in one concern, and provable with headless tests (unit tests or engine integration tests)? Re-check that no open PR touches it (search "repo:storytold/gridcraft is:pr <number>").
Return a concrete plan naming the exact functions to change and the tests to add.`,
  { label: `vet:#${c.issue}`, phase: 'Vet', schema: VET })))).filter(Boolean)

const winner = vetted.filter(v => v.feasible && v.headlessProvable).sort((a, b) => a.estLines - b.estLines)[0]
  && top.find(c => c.issue === vetted.filter(v => v.feasible && v.headlessProvable).sort((a, b) => (top.findIndex(t => t.issue === a.issue)) - (top.findIndex(t => t.issue === b.issue)))[0].issue)
if (!winner) return { outcome: 'none-feasible', vetted }
const plan = vetted.find(v => v.issue === winner.issue)
log(`Building #${winner.issue}: ${winner.subproblem}`)

const BUILD = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    branch: { type: 'string' },
    worktree: { type: 'string' },
    sha: { type: 'string' },
    testsAdded: { type: 'array', items: { type: 'string' } },
    beforeEvidence: { type: 'string', description: 'exact failing output of the new tests on UNCHANGED upstream code, run in a throwaway worktree' },
    gate: { type: 'string', description: 'cargo xtask ci summary line + exit code on the final commit' },
    diffStat: { type: 'string' },
    prTitle: { type: 'string' },
    prBody: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['ok', 'branch', 'worktree', 'sha', 'beforeEvidence', 'gate', 'diffStat', 'prTitle', 'prBody', 'notes'],
}

phase('Build')
const build = await agent(
  `${CTX}
TASK: implement the fix for upstream issue #${winner.issue} (${winner.title}); subproblem: ${winner.subproblem}.
Vetting plan: ${plan.plan}

Steps (follow PLAYBOOK.md sections 5-6):
1. git -C /home/user/gridcraft worktree add -B fix/<short-topic>-${winner.issue} /home/user/gc-${winner.issue} upstream/main
2. Write the regression tests FIRST. Use only behaviour stated/measured in the issue or public docs — never invent expected values.
3. Before-evidence: create a throwaway worktree (git -C /home/user/gridcraft worktree add --detach /home/user/gc-before upstream/main), copy ONLY the new tests in, run just those tests (lean env), capture the failures, then remove that worktree (git worktree remove --force). Report how many fail and the exact assertion output.
4. Implement the minimal fix. cargo fmt --all.
5. Run the targeted tests, then the full gate: (time cargo xtask ci) with the lean env, in the background or with a long timeout; it takes 6-18 min. It must print "CI summary: all 8 steps passed".
6. Commit on the branch: message "#${winner.issue}: <imperative summary>" + a short body, ending with exactly these two trailer lines:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01E4Tg9X1CZVxJcr9VRwFuai
   Do NOT push.
7. Draft the PR title and body modelled on merged PR #712 / open PR #1595 (problem from the user's view with issue link; what changed and the rule; what is deliberately NOT done; validation: tests, N of M fail before with the exact symptoms, gate 8/8, platform Linux x64 / Rust 1.97.0 and base sha; honest limits; final line "Prepared with AI assistance; reviewed independently by a separate agent before submission."). Use "Fixes #N" only if it fully closes the issue, otherwise "Fixes part of #N".
If the bug turns out not to reproduce or the gate cannot go green, set ok=false, explain in notes, and leave the worktree for inspection.`,
  { label: `build:#${winner.issue}`, phase: 'Build', schema: BUILD })
if (!build || !build.ok) return { outcome: 'build-failed', winner, plan, build }

const REVIEW = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['blocker', 'should-fix', 'nit'] },
          where: { type: 'string' },
          problem: { type: 'string' },
          evidence: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['severity', 'where', 'problem', 'evidence', 'fix'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['findings', 'summary'],
}

phase('Review')
const LENSES = [
  `CORRECTNESS lens: is the fix right for every case the issue describes? Edge cases, behavioural regressions in every caller (grep them all), tests that would pass on broken code, expected values not backed by the issue/docs.`,
  `REPO-RULES & PR-HONESTY lens: never-crash rules (no unwrap/expect/indexing on hostile input, bounded allocations/recursion), layering, wasm safety, everything-is-a-command, style match with surrounding code, doc updates needed per CLAUDE.md "Roadmap" section, and whether every claim in the PR body below is literally true and verifiable.\nPR body:\n${build.prBody}`,
]
const reviews = (await parallel(LENSES.map((lens, i) => () => agent(
  `${CTX}
TASK (read-only; do NOT run cargo, do NOT edit): independently review the fix for upstream issue #${winner.issue} on branch ${build.branch} in ${build.worktree}. Diff: git -C ${build.worktree} diff upstream/main...HEAD. Read the issue via GraphQL.
${lens}
Report concrete findings with file:line and evidence. Say plainly if there are no blockers.`,
  { label: `review:${i === 0 ? 'correctness' : 'rules+honesty'}`, phase: 'Review', schema: REVIEW })))).filter(Boolean)

const actionable = reviews.flatMap(r => r.findings).filter(f => f.severity !== 'nit')
log(`Review: ${actionable.length} blocker/should-fix findings, ${reviews.flatMap(r => r.findings).length - actionable.length} nits`)

let final = build
if (actionable.length) {
  phase('Fix')
  final = await agent(
    `${CTX}
TASK: address these review findings on branch ${build.branch} in ${build.worktree} (current commit ${build.sha}). For each, either fix it or explain precisely why it is wrong (with evidence). Then cargo fmt --all, re-run the targeted tests and the FULL lean gate (must print "CI summary: all 8 steps passed"), and amend nothing — add a new commit with message "#${winner.issue}: address review" ending with the same two trailer lines:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01E4Tg9X1CZVxJcr9VRwFuai
Do NOT push. Update the PR title/body if anything in it changed or became inaccurate; keep the before-evidence (re-run it if tests changed).
Findings:
${JSON.stringify(actionable, null, 2)}
Current PR body:
${build.prBody}`,
    { label: `fix:#${winner.issue}`, phase: 'Fix', schema: BUILD })
  if (!final || !final.ok) return { outcome: 'fix-failed', winner, build, reviews, final }
}

return { outcome: 'ready', winner, plan, build: final, reviews, nits: reviews.flatMap(r => r.findings).filter(f => f.severity === 'nit') }