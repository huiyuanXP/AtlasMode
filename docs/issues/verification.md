<!-- atlasmode-v1:verification -->

## 实现

基于已批准 revision 和新的真实快照核对节点、调用、目标文件和约束。输出 satisfied/unsatisfied/unknown，附源码/测试证据；不能把结构通过等同功能正确。临时节点到真实符号的绑定有歧义时保持 unknown。

## 验收

- [ ] Agent 通过 MCP 提交 fetchNotes 规划，UI 改接到 requestWithRetry、删除辅助函数、调整目标文件后确认。
- [ ] MCP 读取用户批准的准确 revision 后实施，刷新可核对新增函数及调用。
- [ ] 故意改用底层请求实现时，报告指出绕过既有抽象。
- [ ] 并发 revision/语义审批失效/布局不失效/工作树过期具备集成和浏览器测试。
- [ ] 重启后知识、布局、审批历史和核对报告仍存在。
- [ ] npm ci/typecheck/lint/test/build + MCP 集成 + Playwright E2E 通过，首版就绪报告准确。
