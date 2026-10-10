<!-- atlasmode-v1:mcp -->

## 实现
查阅官方 SDK 文档，锁定同一稳定 major 的包/导入/schema。新增 apps/mcp，仅通过 loopback HTTP 访问 server；stdout 只含协议，日志 stderr。

## 验收
- [x] 支持 README 的 get_project_summary/search_functions/get_function_context/get_subgraph/get_groups/get_folder_policies。
- [x] 支持 propose_plan/update_plan/validate_plan/get_approved_plan/propose_group/refresh_index/verify_implementation。
- [ ] 规划、注释、功能集和策略具备明确创建、读取、更新、删除/取消工具与版本冲突。
- [x] 查询均带 snapshotId/来源/unresolved，强制分页或预算。
- [x] MCP 与 UI 读取同一修订；MCP 无审批工具，也不接受伪造批准。
- [x] 官方 MCP client 真正启动 stdio 进程并完成 tools/list 与 tools/call；提供可运行配置。

2026-10-10 实际复核：clean 隔离781/65包含真实官方SDK stdio tools/list/tools/call、预算/分页/unknown证据、项目归属、伪造审批拒绝、同修订及重启；18/18真实Chromium包含完整UI/SDK规划批准/持久核对流程。AG05直接Responses本地HTTP fixture→真实SDK→SQLite草稿/取消也通过，真实外部Provider仍PARTIAL。证据：https://github.com/huiyuanXP/AtlasMode/blob/fix/first-use-20261010/docs/superpowers/reviews/ci-repair-2026-10-10/README.md 。完整规划/注释/组/策略的创建读取更新删除/取消工具集合尚未全部实现（尤其独立注释与取消），第三项不勾选，Issue保持open；SDK成功不能代替Claude/Windows交互客户端门禁。
