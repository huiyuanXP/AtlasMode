# IDX-03 rev0 独立设计审查原始记录

Reviewer：原 /root/idx01_impl/idx02_review，gpt-6.1-sol high。只读审查；未执行产品测试/build/目标代码，未修改产品。
以下原结论保留，不以修订后文档覆盖：

IDX03 rev0 结论：无 Critical；修订 2 项 Important 后可实施，当前仍为设计阶段、票据 TODO。

1. idx03-design.md:40–41：把整个引用 closure 的源码加入同一 Program，仍可能注入依赖项目的 global symbols。需明确模块依赖按导入加载，或拒绝没有 import 证据的跨 scope 符号。负例须来自真实 referenced 项目。
2. idx03-design.md:32,36–37：solution 根 files:[]、引用合法 named leaf 与 missing 项目时，根 closure 失效和合法分支保留规则冲突。明确根授权失效与有效 leaf 独立归属的区别，并固定验收例。

Minor：
- 公共 schema 明确数组/string 上限、非负整数 counts、四类 scope 数量之和及截断一致性；reason 截断提供明确标志。
- 引用原始 path 在拼接前拒绝绝对、drive、UNC、URL、NUL。
- UI ownership 路径应写为 apps/web/src/app/Navigation.tsx。

已确认：可选字段兼容历史 missing；SQLite JSON 无需迁移；v3 捕获配置字节及 snapshot fingerprint 支持新鲜度；现有 MetadataReader 安全边界可复用。公开采样不参与授权，partial 与 transport truncation 分离的方向正确。

实施条件：两项规则修订、主控确认 core/Nav/i18n 窗口与 scope checker 策略。完整 solution builder、emit/dist 推断及 IDX04 身份迁移留在明确范围外。

已同步 main 与 idx01_impl；全程只读，无产品修改、目标执行、测试或 build。

原rev0 spec与plan副本保留于 rev0/，供对照行号。后续 rev1 限定复审另存，不能把自审当独立复审。
