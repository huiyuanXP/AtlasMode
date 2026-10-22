# AtlasMode：CI 修复专用线程交接

## 目标与生命周期

用户要求每个线程完成一项并交接后，用新线程做下一项。本线程只收尾重启后的 CI 运行夹具修复；PERF02 和其余票据保持未启动/暂停。用户最新明确“这一步弄完之后先停一下，需要重启服务器”：本轮冻结保存后停止，不自行重启或恢复下一项。父线程负责创建下一线程，不自行继续消费票据。

## 环境与保护边界

- ROG：`/home/strix/Documents/Codex/2026-10-10/task-3`。
- SSH：`ssh -F /home/strix/infrastructure/VM/SSH/infrastructure.sshconfig -o BatchMode=yes VM2`；真实主机 `atlasmode`、用户 `agent`。
- 原仓库：`/home/agent/projects/AtlasMode`，origin `huiyuanXP/AtlasMode`，原主 checkout 仍 HEAD `0991dbc962981c4aa1b1a13473fce66abd6b8502`，其用户 AGENTS 与其它 pending 改动保留，索引为空。勿 reset、清场、整份覆盖共享文件。
- PATH 加 `/home/agent/.local/bin`，Node24.19.0/npm11.9.0。检查 `.agents/skills` 与 AGENTS；沿用 Superpowers、neat-freak，生成记忆只读。
- 用户已明确授权按票/重大阶段更新文档后 commit 与普通 push，以 GitHub 为保底；不授权 merge、部署、权限更改、读取密钥或 `/root/.codex/sessions`。仅操作本任务自有进程和目录。
- 例行盘点/CI 作者 `gpt-6.1-sol low`；复杂实现与独审 `gpt-6.1-sol high`。不得改全局模型设置。

## 已恢复并备份

ROG/VM 两重启归档 SHA 均通过，原 `restart-checkpoint-20261011` 保留历史。持久 publisher：`/home/agent/projects/AtlasMode-checkpoints/2026-10-11-pre-restart/publisher`，branch `checkpoint/fs-kn-pol-20261011`。

首提交 `f70e0f2916919fd003b04fae6406ea09d025fef3`；剩余 31 个路径严格验索引范围、314 源路径 SHA 后，第二提交 `ed793266b9dcac5cfa65f1a5358ec97d5184a69f` 已普通推送到 `fix/first-use-20261010`，远端精确匹配。publisher 原 8 个未跟踪 raw 日志/补丁保留；它们的无损归档已提交，不要删除唯一 raw 副本。

对应已验候选：1374 单测、53 浏览器场景，以及 build/types/lint/smoke；这是本地阶段证据。24 个登记服务在暂停前关闭。原 Linux/mac/Windows native CI 失败不能被本地通过覆盖。

## 当前真实 CI 与原始失败

固定 SHA ed793 的 run：<https://github.com/huiyuanXP/AtlasMode/actions/runs/38108513324>，整体 FAIL。

- browser：53 passed，job114379013593。
- Ubuntu：1366 PASS/8 FAIL，job114379013700。
- macOS：1365 PASS/9 FAIL，job114379013702。
- Windows：1334 PASS/12 FAIL/18 skip、1372 total，另 worker 异常，job114379013626。dev/index 的既有 Windows 条件少两例，不是 worker 丢两例的证据。

远程原日志及最终 JSON：publisher 父目录 `resumed-backup/ci/{ubuntu,macos,windows,browser}.log`、`run-final.json`；ROG `resumed-backup-20261011/` 同名副本。严格保留原失败。

根因范围：POL01 两测试文件共 8 例无条件 TSX/source 启动且硬编码 VM 私有 `/tmp/atlasmode-pol01-runtime-tsconfig.json`；mac stale-SHM watcher 在 raw 指纹相等时收到 rename 事件，因果未证；Windows SDK stop 把 SIGTERM 强杀误当正常 exit0、structure-file 权限断言固定 POSIX640。Windows worker 无文件定位，annotation37 缺 summary 仅候选。

## 当前修复冻结结果

工作区：`/home/agent/projects/AtlasMode-checkpoints/2026-10-11-ci-runtime/workspace`；branch `fix/pol01-ci-runtime-20261011`；BASE ed793。作者已 DONE_WITH_CONCERNS，释放唯一写窗口。

父目录 `repair-brief.md`、`repair-report.md`、`diff.patch`、`owned-manifest.json`、`freeze.sha256`；`freeze/source/` 精确7文件和 `freeze/evidence/` 原始日志均持久保存。ROG `ci-runtime-repair-20261011/` 有报告/补丁/manifest/完整 evidence 双份；3个主文件SHA已核对。作者报告 SHA `49d916e5c0603db8a2688ce288473efca2259961225179a084b580d9fb78ef15`，patch SHA `d6ce29cc007556a3ea175e883d0b6ca01f4415431f0815b35b32ab0618114e53`。

仅改7个test/support文件：两POL HTTP tests、annotation-migration.test、structure-file.test、pol01-acceptance.ts、pol01-crash.ts、新pol01-runtime.ts。compiled harness用Node24 typestrip，产品包实解析dist；source兼容用自有config。hardcrash保严格SIGKILL及durable到达见证。正常停止复用已有IPC preloader调用生产处理函数，严格exit0/stdio/端口/PID/freshDB。annotation保原37及raw身份、原路径SQLite open与同步fs操作观测，增加3真实负例；watcher事件保诊断而非因果结论。mode精确保持平台实际prewrite，POSIX640仍断言。production/workflow/已审Python55 helper不改。

最终定向78 PASS（POL24+annotation40+structure11+SDK3），root/fixture types、lint与freeze校验通过。原POL RED8、observer控制RED2和中间失败原日志保留。46自有PID全部不存在，18端口关闭，activeOwnedServices=[]；没有挂起测试。未重复本地1374/53矩阵。

**原生仍未验**：Windows strict hardkill tuple、IPC/freshDB/实际mode和worker异常，macOS原SHM事件因果和新observer真实运行均待新固定SHA CI。Linux78不是跨平台绿，三票不能闭为DONE。独审及备份最终结论见文末补记；重启后只读最终补记恢复。

## PERF02 暂停现场，下一线程不能重复派工

工作区：`/home/agent/projects/AtlasMode-checkpoints/2026-10-11-perf02-task3/workspace`；branch `task/perf02-visual-20261011`；BASE ed793。原作者 `/root/perf02_visual_task3` 已安全暂停，无 writer/测试进程。

父目录 `task-3-brief.md`、`task-3-report.md`、`before-manifest.json`、`dependency-assembly.json`、`evidence/pause-state.json`。15 prior A/B 源哈希核对一致，仅复制12独占新依赖+私有core export；server shared B hunks延期。两新 owned 文件：

- `overview-visual.ts`：`ccd5733b986251a648fa2b4bb1e1889d20a4098584de8c223e3253d229633b98`。
- `overview-visual.test.ts`：`f1c6fb14ddf1c2b7b9558672b253f12067b9e6e5b6f23acbdfa77136913abac2`。

只有初始测试和4个占位接口，未实现预检/几何。npm ci 成功，Vitest owner 配置 import 启动失败；没有真实 RED，不能称 Task3 已通过。下一步先修私有 Vitest module resolution（owner在workspace父目录）、跑 projection/groups/global baseline，然后从原测试开始真正 RED→GREEN。保持只写两个新文件，独审冻结后才进入共享 Task4；不得把固定300×220全局布局冒充可变尺寸局部几何。若新线程无法恢复原子代理，以这份报告/精确 bytes 接续同一任务，勿重新做 A/B。

## 剩余票与依赖

当前 36 票仍 19 DONE、FS01/KN01/POL01 为 REVIEW，剩余其它14：KN02、DATA01、POL02、IDX04、DIFF01、GRP03、PERF01、PERF02、QA02、OPS01、FUT01、AG02、AG03、AG05。新实际 CI 通过后才能将三票关闭为22 DONE/14剩余。

优先最小下一项：CI 尚红则仅续当前修复；CI 已关闭则开新线程续 PERF02 Task3。Task3→Task4 Workspace/Canvas/session/worker→Task5真实 Express/Flask/Vite/DOM/性能验收，helper测试不能替代 UI。详细依赖在 `pending-dependency-audit-20261011.md`，PERF02原盘点已由 `perf02-task3-prerequisite-20261011.md` 修正。KN02→DATA01；IDX04→DIFF01→FUT01；QA02→OPS01；PERF01与IDX04共享 indexer 要排窗；AG03保持 native guard A，真实Windows G1–G8未验；AG05真实Provider配置/最小付费调用授权待补，CLI Profile不是直接Provider验收。

固定公开目标已经恢复到 `/home/agent/projects/AtlasMode-checkpoints/validation-targets-20261011/{express,flask,vite}`，各自 pinned SHA/clean/source清单见 `provenance.json`；仅 Git检出，未执行目标代码，未测新性能。原 live preview 未在本线程重开。

## 恢复命令

```bash
export PATH=/home/agent/.local/bin:$PATH
cd /home/agent/projects/AtlasMode-checkpoints/2026-10-11-ci-runtime/workspace
git status --short
git rev-parse HEAD
# 精确作者报告中的定向命令优先；compiled产品先在私有workspace build。
POL01_ACCEPTANCE_MODE=compiled npx vitest run apps/server/src/pol01-workspace-http.test.ts apps/server/src/pol01-http-repair.test.ts tests/integration/pol01-stdio-acceptance.test.ts
gh run view 38108513324 --repo huiyuanXP/AtlasMode --json headSha,status,conclusion,jobs
```

下一线程必须先读最终交接补记与 GitHub 精确 SHA，确认独审及 CI 状态。当前 Linux 定向通过，跨平台闭环未完成；不要直接推进下一票。


## 最终停止补记（2026-10-11）

独立窄审 APPROVE，仅认可 test-only checkpoint，C0/I0/M0；核验7源SHA、88 freeze条目、6原源before SHA、真实compiled dist/硬杀witness/IPC exit0/observer负例与身份/实际mode。未重复运行矩阵。正式 `review.md` 保存于 CI runtime owner，并随独立备份文档保存。

用户要求此步完后停止等待重启。将7 test/support文件和报告/完整证据提交到隔离分支 `fix/pol01-ci-runtime-20261011` 作为备份，原 `fix/first-use-20261010` 保持 ed793。原主 checkout及其它票不改、不闭票；本线程不再继续实现、不自行重启。精确新提交及普通push收据在owner `backup-commit-receipt.json` 和 ROG `ci-runtime-repair-20261011/backup-commit-receipt.json`；使用收据SHA核验远端。

原run38108513324仍FAIL，新的native CI不因APP而宣称通过。重启后先确认远端备份SHA和作者/审查资源退出，再在新线程只完成当前跨平台CI闭环；成功后才能另开下一票。PERF02 Task3源码已双份保存，仍暂停。
