# 2026-10-10 首用 CI 测试修复

当前状态：本地限定验证通过；修复提交后的原生三平台与完整浏览器 CI 重跑待主控完成。远端历史 run [38059730657](https://github.com/huiyuanXP/AtlasMode/actions/runs/38059730657) 保持 FAIL，其 Linux/Windows native PASS、macOS native 一项 FAIL、browser 六项 FAIL 是本次修复输入。

## 第二轮：分组入口与地图遮挡

提交 40710123061a5d1e86fb9269d4d3689a24de4691 的 [CI run 38061633736](https://github.com/huiyuanXP/AtlasMode/actions/runs/38061633736) 已确认 Linux/Windows/macOS native 全部 PASS；browser 14 PASS /3 FAIL，原结果保留为历史检查点。

- agent-chat/planning 使用旧高级控件内的分组表单。当前 GRP-01 使用「Manage groups」独立披露与「Create group」显式开始 draft，成员选择入口为「Choose loaded functions」。测试沿真实界面创建同一 Shared membership，原规划修订、MCP/HTTP、批准与持久化结果断言继续保留。
- 地图为产品遮挡：展开时 mapSide 用冻结的 mapSelection，而 inspection overlay 用当前视口的 selectionRect。平移/缩放后详情可能换到地图同侧；原 CI [实际截图](round2-original-map-overlay.png) 显示地图右 360px 被详情覆盖。主控授权 Canvas 窄修复，GRP owner 提供安全写入窗口。
- 新回归在宽画布中通过小地图键盘导航让选择跨左右侧。修复前 [重叠 RED](round2-map-red.log) 测得 100800px²，修复后须为 0px²。Canvas 在地图展开期间让详情使用同一 mapDetailPlacement，双方保持相反侧及固定位置；收起恢复当前 selectionRect 对应布局。[独立产品 patch](map-placement.patch) 仅包含该 hunk，供主控隔离 GRP-02 的其他 Canvas 改动。
- 原 55px/30px 真实拖动、分页保持、地图缩放/平移、地图位置稳定与 Esc 链继续验收；地图点击前重新读取 SVG bounds，并新增实际 camera 变化断言。
- 独立首次审查提出 Important I1：1900px 的共存回归尚未覆盖原 CI 1600px。[原始 REQUEST_CHANGES](round2-independent-review-initial.md) 保留。补充同一真实漏斗在 1900/1600 两轮地图完整交互；日志实测 canvas 分别 1190/930px，均为 dock-side 且详情与地图同时可见、交叠面积 0。两轮均验证 zoom/drag/wheel/key pan/click 实际 camera 变化及地图位置稳定，收起恢复详情；最终在 1600 执行详情→漏斗 Esc 链。测试同时保留已有 compact 暂隐藏详情的界面合同。
- 直接浏览器截图：[1600 地图与详情](round2-map-navigation-1600.png)、[1600 收起恢复](round2-map-collapsed-1600.png)、[1900 地图与详情](round2-map-navigation-1900.png)、[1900 收起恢复](round2-map-collapsed-1900.png)。

| 第二轮检查                  | 结果                               | 证据                                                                   |
| --------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| 原 CI                       | 三平台 native PASS；browser 3 FAIL | [远端日志](round2-original-ci-failed.log)                              |
| 本地旧分组流程复现          | 2 FAIL /2 PASS；地图本机旧用例通过 | [browser RED](round2-browser-red.log)                                  |
| 定向地图产品回归            | FAIL，交叠面积 100800px²           | [RED 日志](round2-map-red.log)、[RED 截图](round2-map-overlap-red.png) |
| 定向候选 browser            | 4/4 PASS，39.8s；交叠面积 0px²     | [GREEN 日志](round2-browser-green.log)                                 |
| 原 CI 尺寸补充 graph        | 1/1 PASS，14.5s；1600/1900 均零重叠 | [补充 GREEN](round2-final-graph-green.log)、[四文件 lint](round2-final-lint.log) |
| 候选 web build /四文件 lint | PASS                               | [build](round2-web-build.log)、[lint](round2-lint.log)                 |
| 独立审查                    | APPROVE；Critical 0 / Important 0 / Minor 0                            | [独立 high 复审](round2-independent-review-final.md)                                 |
| 提交后的完整 CI             | pending                            | 主控整合后推送重跑                                                     |

验证使用主控已完成 clean gates 的隔离候选 /tmp/atlasmode-integration-20261010-1505，仅拷贝三测试与独立 Canvas hunk，执行 web scoped build。[编译快照](round2-compiled-snapshot.json) 记录实际入口和 web assets 校验值。第一次 runner 启动误用了共享 checkout 的 Playwright CLI，导致两实例不兼容；[该失败](round2-runner-startup-failed.log) 已保留，最终命令使用候选自身 CLI。build 保留既有 500kB chunk warning。最终全根门禁由主控运行。

本轮 neat-freak 状态：代码与限定运行态 changed-and-verified，文档 changed-and-verified，现役规则 verified-current，记忆 not-applicable；独立评审已 APPROVE；新完整 CI 和共享分支集成 pending。原始 CI artifacts、隔离 RED/GREEN traces 与候选仍保留供复核，由主控管理清场。

## 第一轮根因与最小改动

1. **进程 cwd 的物理目录身份。** macOS 将临时目录的 /var 表示为 /private/var，原测试把等价目录的文本差异当成失败。process.test.ts 添加普通目录与符号链接目录两种真实子进程用例，使用 realpath 验证目录身份；完整保留 stdin 与 args 原文的深相等断言，并增加 sentinel 文件 ENOENT 验证。
2. **显式源码加载动作。** 首用迁移的 openSourceDrawer 将已打开的 tab 当作该节点源码已加载，跳过「查看源码」动作。实际卡片单击等待 200ms 双击窗口后选择新节点，并清空上个节点的源码。CommonJS/tsconfig 先等到正确目标 code.path，再加载源码；helper 每次明确点击加载动作。forwarding 原本已有目标身份等待，沿用同一 helper 修复。中英原文、真实目标、只读性、复制位置、HTTP/MCP 一致性、离线边界与目标代码未执行的原断言保留。
3. **真实拖动与布局动画的区别。** 原 CI trace 在 71823ms 读取运动中卡片 bounds、71870ms pointer down、72102ms pointer up。72128ms 截图仍有详情，72388ms 详情已被 pane 手势清空，发生在分页、地图与 Esc 之前。原测试只比较 transform，将布局动画/相机变化误当作节点拖动。helper 先让实际 hit target 稳定，再跨 React Flow drag threshold，确认 .dragging 并记录 dragStart；随后验收真正的 55px/30px 位移。详情在拖动后以及小地图收起后均须恢复可见，原 Esc 依次关闭地图、详情、漏斗的断言继续验收。

第一轮改动全部位于测试和测试 helper，产品源码保持其他工作流的所有权。图检查最新共享构建在修改前本机已通过；原 CI 的失败由保留的 trace/截图提供证据，不能把共享构建的 PASS 当成旧提交的重跑 PASS。

## 验证证据

| 检查                                  | 结果                                                                                                                                            | 证据                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 原始远端 CI                           | native macOS 1 FAIL；browser 6 FAIL                                                                                                             | [原始失败日志](original-ci-failed.log)                                                |
| Linux 符号链接复现                    | 1 FAIL / 10 PASS，失败为 cwd 字符串差异                                                                                                         | [process RED](process-red.log)                                                        |
| cwd identity 与 literal/sentinel 验收 | 11/11 PASS                                                                                                                                      | [process GREEN](process-green.log)                                                    |
| 相关 browser 修改前                   | 5 FAIL / 2 PASS，五项源码失败重现                                                                                                               | [browser RED](browser-red.log)                                                        |
| 相关 browser 修复后                   | 7/7 PASS，34.4s                                                                                                                                 | [browser GREEN](browser-green.log)                                                    |
| 拖动位移诊断                          | 起点早于 drag threshold，差 5px 的 FAIL 保留                                                                                                    | [诊断日志](drag-threshold-diagnostic.log)                                             |
| threshold 后精确位移与完整图检查      | 1/1 PASS，11.2s                                                                                                                                 | [图检查 GREEN](drag-final-green.log)                                                  |
| 共享半写工作区整套诊断                | 715 tests /63 files PASS；AG-05 direct-loop.test.ts:234 的 const const 导致 1 suite transform FAIL，最终整套门禁由主控在各 scope 冻结后统一运行 | [诊断日志](shared-tree-diagnostic-test.log)                                           |
| 修复范围 ESLint                       | PASS，退出码 0                                                                                                                                  | process.test.ts、chat-shell.mjs、commonjs/tsconfig/forwarding/graph-inspection 六文件 |

隔离 Playwright config 位于 /tmp/atlas-ci-repair*.config.ts；RED/GREEN/精确拖动均使用独立输出目录。原始 CI artifacts 保留于 /tmp/atlas-ci-repair-original，源码实验的 trace 保留于 /tmp/atlas-ci-repair-red/results，最后拖动 trace 在 /tmp/atlas-ci-repair-drag-final/results。这些 trace 是复核现场，由主控决定保留和清场。

源码与图检查使用真实 production server、Chromium 和 stdio MCP。已记录 [compiled snapshot](compiled-snapshot.json) 的 server/MCP 入口与 web HTML 校验值；此记录标识本次共享构建入口，后续 AG-05 编译由主控另行验收。本修复使用现有依赖及既有共享构建。

原始拖动的关键帧：[移动中](original-drag-in-flight.jpeg)、[pointer up 后](original-drag-after-pointer-up.jpeg)、[闲置后选择已清空](original-drag-idle-selection-cleared.jpeg)。

## 知识收尾与交接

依据项目 AGENTS.md 的系统调试、TDD、独立评审与验证要求，以及已安装 neat-freak v3 的完整流程，在本次 CI scope 中核对：

| 事实面 | 状态                                               | 处理                                                                                 |
| ------ | -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 代码   | changed-and-verified                               | 五个测试/helper 文件改动；产品实现由各 ticket owner 保持                             |
| 运行态 | verified-current（本地限定）；pending（新远端 CI） | 当前共享构建真实浏览器与子进程验收                                                   |
| 文档   | changed-and-verified                               | 本页集中记录当前结论、历史 FAIL 和证据；上级状态入口由主控整合                       |
| 规则   | verified-current                                   | 已读取全局 Codex 约定及项目 AGENTS/CLAUDE 同源指针；规则文件保持原有权威             |
| 记忆   | not-applicable                                     | 本修复使用项目文档交接                                                               |
| 工作区 | pending（主控集成）                                | 共享分支其他 ticket 改动及本次 trace/临时 config 现场保留，当前 agent 未 commit/push |

机械盘点保存于 /tmp/atlas-ci-repair-inventory.log。当前待办：主控整合独立评审与完整套件结果，提交并推送后重跑真实 CI；历史 FAIL 继续保留可检索。合并、生产发布和其他工作流不属于此 CI 修复的执行范围。

## 主控最终联合隔离门禁

冻结暂存树 `fefda8e74361853c252b2c75bb14d4a5c91d8220` = 已推送cfda22b（含IDX02/AG05/SEC）加本轮独立地图patch与三browser用例；不含用户AGENTS或GRP02产品改动。git archive到`/tmp/atlasmode-integration-20261010-1530`。首次复制1505安装产物构建在scan.ts230 ignore()出现TS2349，保留 [原失败](integration/atlasmode-integration2-build.log)；准确根因未确定，不能归因为产品缺陷或把setup失败冒充PASS。随后同冻结锁f26ef3a7 clean npm ci：397安装/405审计/0vulnerabilities，全部重新build/typecheck/lint、781测试/65文件（15:29:35 UTC起60.82s）、生产smoke、18/18 Chromium（1.7m）全部PASS。完整日志在integration目录，主控已查看final1600图确认双方可见。此证据不包含尚在实施的GRP02，也不能替代AG05真实外部Provider gate。

之前77e4554实际CI38062761771三nativeOS全部通过，browser15/18通过；失败仍为旧分组入口2项和已复现地图遮挡1项，ResponsesAPI fixture通过。新修复提交后实际remoteCI仍待检查，不把本地18/18冒充远端收据。所有旧失败与初始REQUEST_CHANGES/最终APPROVE保持历史。

## 远端完整门禁收尾

2026-10-10 最终验收：提交7528f78302275acb11cb9a23b49cb284d2a7fd9f的远端CI [38064184377](https://github.com/huiyuanXP/AtlasMode/actions/runs/38064184377) 四个job全部SUCCESS：Linux、Windows、macOS native及Chromium。冻结锁SHA256 f26ef3a7cf494becb903226ef01d86dfa7ca1e014c271e284bb0db1b9cee49c4；对应clean隔离快照全根build/typecheck/lint、781/65测试、smoke及18/18浏览器通过，npm ci审计0。原始远端收据：[JSON](../ci-repair-2026-10-10/remote-ci-38064184377.json)。此门禁不包含尚未提交的GRP02、IDX03等候选。
