# AtlasMode agent instructions

## Start every session with Superpowers

The user selected the complete Superpowers workflow for this project. Before
responding or doing development work, read:

1. `.agents/skills/using-superpowers/SKILL.md`
2. `.agents/skills/using-superpowers/references/codex-tools.md`
3. `docs/superpowers/state.md` and the root `README.md`

Skills are installed in this repository under `.agents/skills/<name>/SKILL.md`,
including their scripts, references and review prompts. Read the relevant skill
in full before using it. Announce which skill you are using and why. If the
current session does not expose a Skill tool or has not refreshed its catalog,
load these local files with the available file-reading/shell tool; do not wait
for a global plugin installation. Names such as `superpowers:brainstorming` in
upstream prose resolve to `.agents/skills/brainstorming/SKILL.md` here.

## Development workflow

- New projects, features and architectural changes start with `brainstorming`.
  Ask one focused question at a time. For architectural work: discuss approaches,
  present design sections, save and review the written spec, then use
  `writing-plans`. The user's approval of one stage does not approve later stages.
- Save specs to `docs/superpowers/specs/` and plans to `docs/superpowers/plans/`.
  Use the user's local date for new documents. Keep `state.md` updated at handoffs.
- After written-plan review and execution-method selection, follow
  `subagent-driven-development` or `executing-plans`. Use the actual available
  collaboration tools. Do not pretend a self-review is an independent review.
- Follow `test-driven-development` for product behavior and
  `systematic-debugging` for failures. Run meaningful checks and use
  `verification-before-completion` before success claims or commits.
- Use `requesting-code-review`, `receiving-code-review`, and
  `finishing-a-development-branch` at their prescribed stages.

## Cloud/tool adaptation

System/developer rules, explicit user instructions and repository constraints
have priority over upstream defaults. In Codex Cloud, each task is already
isolated: use the existing checkout; do not create another Git worktree unless
the user explicitly requests one. Read `using-git-worktrees` to inspect the
workspace when the workflow reaches that stage, applying this cloud constraint.
Use the tool schema's real parameters and permitted models for subagents; do not
modify global Codex configuration merely because upstream examples suggest it.
Do not expose loopback preview links or start the optional browser companion
unless the environment provides a supported private preview mechanism.

## Product constraints

The README is the product specification and package-boundary guide. The project
currently has no application manifests or runnable product. Do not run `npm ci`
or claim application tests pass until actual manifests and tests exist.
Use Node.js 24 LTS and npm workspaces with one root package-lock.json when the
approved implementation reaches initialization. Preserve core/indexer/storage/
service/UI boundaries. Label demo data as demo; report unresolved static calls.
Never commit credentials, SQLite databases, caches or copies of target repos.

## Verify the installed workflow

From the repository root:

```bash
sha256sum --check docs/superpowers/vendor.sha256
```

Upstream version, installation scope and update instructions are recorded in
`docs/superpowers/README.md`. Keep vendored skill contents unchanged; put project
adaptations in this file and update the pinned source and checksums together.
