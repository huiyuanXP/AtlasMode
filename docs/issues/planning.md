<!-- atlasmode-v1:planning -->

## 实现

单一 core 规划规则，service 编排；网页/MCP 不另造状态机。新增/修改/删除规划函数、调用关系、目标文件和约束，全部以明确 snapshot baseline 为基础。提供图上改接调用、目标文件预览、删除冗余节点和撤销/重做。

## 验收

- [ ] 新节点使用规划临时 ID；端点、类型、文件归属、显式目录约束可校验；信息不足标记 unknown。
- [ ] expectedRevision 冲突返回 409，不能覆盖他人修改。
- [ ] UI 确认准确保存用户改接后的 B，而非原来的 A；审批固定 revision/hash/baseline。
- [ ] 语义修改产生新 revision 并撤销旧确认；布局修改不撤销。
- [ ] 实施前检测实际工作树，过期规划不可作为有效批准读取。
- [ ] MCP/客户端 approved=true 不能伪造确认；取消/删除规划保留历史。
