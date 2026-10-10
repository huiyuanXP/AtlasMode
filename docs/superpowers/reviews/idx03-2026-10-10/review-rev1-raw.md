IDX03 rev1 设计复审 APPROVE：原 2 项 Important 和 3 项 Minor 均已解决，无新增 C/I/M。

I1 已明确 owned-only rootFiles、依赖按模块导入加载和跨 scope guard；I2 已分离失败 root 授权与合法 named leaf 归属，并固定正负验收场景。公共 schema、路径拒绝规则及 UI 文件路径修订完整。

可实施条件只剩主控协调 core/schema、Navigation/i18n 和共享 build 窗口。IDX03 仍为 TODO；本轮仅只读文档审查，未运行代码、测试或 build。已同步 main 与实现者。
