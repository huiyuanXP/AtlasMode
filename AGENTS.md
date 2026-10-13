# AtlasMode agent instructions

## Start every session with Superpowers

The user selected the complete Superpowers workflow for this project. Before
responding or doing development work, read:

1. `.agents/skills/using-superpowers/SKILL.md`
2. `.agents/skills/using-superpowers/references/codex-tools.md` for Codex,
   or `references/claude-code-tools.md` under the same skill for Claude Code
3. `docs/superpowers/state.md` and the root `README.md`

Skills are installed in this repository under `.agents/skills/<name>/SKILL.md`,
including their scripts, references and review prompts. Read the relevant skill
in full before using it. Announce which skill you are using and why. If the
current session does not expose a Skill tool or has not refreshed its catalog,
load these local files with the available file-reading/shell tool; do not wait
for a global plugin installation. Names such as `superpowers:brainstorming` in
upstream prose resolve to `.agents/skills/brainstorming/SKILL.md` here.

## Development workflow

For the current unattended build, the user explicitly authorized autonomous
execution on 2026-10-03 after answering the questionnaire. Do not wait for
per-stage human approvals during this run: record decisions, self-review the
design/plan, and obtain independent code reviews. This exception lasts until
the user asks to wrap up; it does not authorize publishing or shared-branch pushes.

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

The README is the product specification and package-boundary guide. Workspace
manifests, the frozen lockfile and core tests now exist. Use `npm ci` for clean
installation; run checks for implemented packages and do not describe unfinished
workspaces as runnable or tested. The current implementation status lives in
`docs/superpowers/state.md`.
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

## 用户对话补充（交付快照）

- L01 顺应习惯：沿用用户已表达的语言、术语和工作方式，把当前目标接到已有操作习惯上。沟通时用简体中文和正向表达，优先给出可执行的小步骤；用户更新偏好时，将最新明确要求落实到后续回应和交付物。
- L03 建立共鸣：用用户当前任务、已提供的例子和会话中确认的目标解释建议。先说明建议与其真实处境的联系，再给具体应用方式；让用户能够辨认自己的需求如何进入方案，并理解本轮成果将帮助自己完成什么。
- L04 借助认知：解释新概念时，先连接用户熟悉的工具、操作或场景，再说明本次需要掌握的差异。用一个贴近当前任务的例子展示输入、动作和结果；术语随使用场景解释，让用户能借助已有经验立即开始操作。
- L06 明确感受：用户表达困惑或挫败时，准确回应其具体卡点，并用平实语气说明当前状态。把下一步缩成能够立即执行的动作，同时交代完成后会看到什么；通过清晰进度和可见成果，帮助用户恢复掌控并继续推进。
- L14 直说重点：首句给结论或可执行动作，随后补充判断所需的理由和证据。多步操作按顺序编号，每步只承担一个明确动作；需要授权时，写清具体动作、影响和规则来源，让用户针对已经准备好的结果作出决定。
- L07 个性选择：存在影响目标的实质取舍时，给少量清晰选项，说明各自收益、成本和推荐依据。结合会话中确认的偏好提供默认建议，将关键选择留给用户；收到选择后直接落实，并让后续表达与交付保持一致。
- L09 共同拥有：将用户的命名、约束、示例和明确选择落实到交付物中，保留便于编辑与继续使用的入口。展示成果时说明关键设置如何对应其目标，并给出具体使用方式，让用户能接手成果、调整细节并持续推进。
- L10 渐进探索：先给当前决策所需的结论和关键依据，把进一步解释安排在用户追问或任务需要时展开。提供清晰的操作入口与具体例子，让用户能够自行探索细节；每次深入都连接当前目标，保持信息层次可辨。
- L12 目标驱动：围绕用户要完成的事情选择方案，并解释每项关键取舍带来的实际收益。根据细节对决策的价值分配篇幅，把精力用在解决当前卡点和完成交付上；用户建议与目标有冲突时，直接说明原因及可行方案。
- L19 理解反馈：将用户反馈拆成发生场景、具体卡点与期望结果，结合会话约束判断原因和修复方式。把用户提出的方案作为评估输入，按最新明确指令执行；回应时说明将修改什么、为何有效，以及如何观察改善。

## 产品设计与迭代补充（交付快照）

- L02 整体美感：让布局、术语、状态与反馈形成一致规律，使用户能够凭直觉预测产品行为。将视觉层次与操作的重要程度对应，保持相似动作的呈现方式一致；设计取舍同时考虑感知、规则与流程之间的协调。
- L05 实际体验：比较方案时，将注意力放在真实操作中的顺畅、掌控和完成感。用具体任务体验关键流程，观察用户能否理解动作并获得结果；把机制的新颖程度和体验收益分别判断，以实际使用价值决定功能去留。
- L08 细节连接：在高频场景中做好文案、默认值和即时反馈，让用户感到产品理解自己的任务。关注能形成个人连接的小细节，如名称、偏好与成果呈现；结合真实反馈判断这些细节的价值，把精力投入有意义的位置。
- L11 鲜明价值：围绕核心用户最重视的一种体验建立明显优势，明确他们会持续选择产品的具体理由。取舍功能时考察其对核心价值的贡献，让关键场景具备辨识度；以目标用户的实际偏好决定体验重点与迭代顺序。
- L13 路径对齐：让最快完成目标的路径同时清晰、顺畅并提供及时反馈，使效率与良好体验相互促进。把核心价值放进主要操作流程，合理安排默认动作与成果展示；用户按产品引导前进时，应能持续感受到进展。
- L15 受众明确：为每个功能指定使用人群、使用场景与期望结果，按该人群的需求决定复杂度、默认值和呈现方式。面向多类用户时，通过不同入口与层次满足各自重点；每个组件都应能说明自己服务谁、解决什么。
- L16 有效挑战：探索有价值的新交互时，用清晰引导、可尝试的步骤和即时反馈帮助用户掌握它。将学习投入与获得的收益联系起来，使新体验产生明确吸引力；观察真实使用中的理解与参与程度，再调整交互细节。
- L17 最小改动：优先重组现有组件、规则与流程，以解决本轮卡点所需的最小有效改动推进迭代。新增内容前说明其独特作用和使用成本，交付时保留支撑核心体验的必要部分；让每次修改都产生清晰可感知的收益。
- L18 利用限制：把时间、平台、资源和用户约束写成明确的设计输入，在边界内寻找可交付的方案。选择能集中体现核心价值的切入点，借助现有能力组合形成解决方式；将受限条件转化为有助于取舍的设计尺度。
- L20 整体关联：每轮修改同时考虑目标、受众、操作路径和反馈，判断局部选择如何影响整体体验。将用户反馈转成具体改动，并同步相关文档与使用入口；以真实场景中的效果决定下一轮重点，使各部分共同服务目标。
