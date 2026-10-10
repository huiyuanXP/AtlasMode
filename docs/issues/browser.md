<!-- atlasmode-v1:browser -->

## 实现
用真实 API 取代默认 demo。显示仓库和快照来源、覆盖范围、unresolved 与证据。分页搜索和预算子图；显示文件/目录归属、函数签名、调用上下文和外部包。知识编辑通过统一 service 持久化。

## 验收
- [ ] 默认启动看到真实索引图，加载/空结果/错误/刷新状态清晰。
- [x] 函数搜索、调用展开、证据位置与未知项可查看。
- [ ] 注释/功能集/目录策略可增删改查；同一函数可在多个组中。
- [ ] 移动画布只保存 ViewState，不移动源码；重启布局保留。
- [x] 事实与规划有文字/图标区分，不只靠颜色。

## 2026-10-10 核验状态
搜索/源码/未知证据与事实/规划文字区分有本轮真实浏览器证据：[首用](https://github.com/huiyuanXP/AtlasMode/blob/fix/first-use-20261010/docs/superpowers/reviews/first-use-2026-10-10/README.md)、[CI交互修复](https://github.com/huiyuanXP/AtlasMode/blob/fix/first-use-20261010/docs/superpowers/reviews/ci-repair-2026-10-10/README.md)。[GRP-01](https://github.com/huiyuanXP/AtlasMode/blob/fix/first-use-20261010/docs/superpowers/reviews/grp01-2026-10-10/README.md)已实际圈选和编辑跨目录多组；注释/目录策略完整CRUD尚未完成，因此合并验收项不勾选。其他未勾选整项待完整核验，Issue保持open；新三平台/完整browser CI尚待结果。
