# 2026-10-10 首用 CI 测试修复

当前状态：本地限定验证通过；修复提交后的原生三平台与完整浏览器 CI 重跑待主控完成。远端历史 run [38059730657](https://github.com/huiyuanXP/AtlasMode/actions/runs/38059730657) 保持 FAIL，其 Linux/Windows native PASS、macOS native 一项 FAIL、browser 六项 FAIL 是本次修复输入。

## 根因与最小改动

1. **进程 cwd 的物理目录身份。** macOS 将临时目录的 /var 表示为 /private/var，原测试把等价目录的文本差异当成失败。process.test.ts 添加普通目录与符号链接目录两种真实子进程用例，使用 realpath 验证目录身份；完整保留 stdin 与 args 原文的深相等断言，并增加 sentinel 文件 ENOENT 验证。
2. **显式源码加载动作。** 首用迁移的 openSourceDrawer 将已打开的 tab 当作该节点源码已加载，跳过「查看源码」动作。实际卡片单击等待 200ms 双击窗口后选择新节点，并清空上个节点的源码。CommonJS/tsconfig 先等到正确目标 code.path，再加载源码；helper 每次明确点击加载动作。forwarding 原本已有目标身份等待，沿用同一 helper 修复。中英原文、真实目标、只读性、复制位置、HTTP/MCP 一致性、离线边界与目标代码未执行的原断言保留。
3. **真实拖动与布局动画的区别。** 原 CI trace 在 71823ms 读取运动中卡片 bounds、71870ms pointer down、72102ms pointer up。72128ms 截图仍有详情，72388ms 详情已被 pane 手势清空，发生在分页、地图与 Esc 之前。原测试只比较 transform，将布局动画/相机变化误当作节点拖动。helper 先让实际 hit target 稳定，再跨 React Flow drag threshold，确认 .dragging 并记录 dragStart；随后验收真正的 55px/30px 位移。详情在拖动后以及小地图收起后均须恢复可见，原 Esc 依次关闭地图、详情、漏斗的断言继续验收。

本次改动全部位于测试和测试 helper，产品源码保持其他工作流的所有权。图检查最新共享构建在修改前本机已通过；原 CI 的失败由保留的 trace/截图提供证据，不能把共享构建的 PASS 当成旧提交的重跑 PASS。

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
