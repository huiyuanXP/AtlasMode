<!-- atlasmode-v1:mcp -->

## 实现

查阅官方 SDK 文档，锁定同一稳定 major 的包/导入/schema。新增 apps/mcp，仅通过 loopback HTTP 访问 server；stdout 只含协议，日志 stderr。

## 验收

- [ ] 支持 README 的 get_project_summary/search_functions/get_function_context/get_subgraph/get_groups/get_folder_policies。
- [ ] 支持 propose_plan/update_plan/validate_plan/get_approved_plan/propose_group/refresh_index/verify_implementation。
- [ ] 规划、注释、功能集和策略具备明确创建、读取、更新、删除/取消工具与版本冲突。
- [ ] 查询均带 snapshotId/来源/unresolved，强制分页或预算。
- [ ] MCP 与 UI 读取同一修订；MCP 无审批工具，也不接受伪造批准。
- [ ] 官方 MCP client 真正启动 stdio 进程并完成 tools/list 与 tools/call；提供可运行配置。
