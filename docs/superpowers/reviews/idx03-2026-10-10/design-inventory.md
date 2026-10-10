# IDX-03 只读设计移交

阶段：DESIGN ONLY。spec/plan已写并自审；没有产品实现/TDD/runtime gate，IDX03仍TODO。IDX02冻结产品/证据未改。

现有缺口：configCapture只沿extends；configResolution只nearest conventional config；named references不能提供scope；单一全仓checker需隔离global symbols；strict core coverage拒绝新graph字段。v3已有exact配置hash与安全metadata预算，可直接复用。

主控已认可可选core coverage.configurationProjectGraph方向，并要求有界图/边/counts/truncated/status，scope仅有界样本+准确source总数。spec已据此明确公共50roots/50projects/100refs/50scopes候选预算、字段字符串限额、observed count与partial、未返回scope不代表unknown。

需要main确认：core model/validation窄owner窗口（GRP02freeze后）；Navigation/i18n最小只读graphsection窗口；refs-enabled scope checker与真实物理import授权策略；独立复杂设计review slot。服务/SQLite/HTTP/MCP无需新port/route/tool，summary目前coverage直通。若需要第二层summaryview应统一HTTP/MCP而非仅tool截断。

固定refs fixture是必要真实门禁：实际AtlasMode自身7个workspace配置没有references；不能用此只读盘点代替references成功。官方 semantics参见spec所列TypeScript资料。当前没有实现结果、没有DONE主张。

Owned新增：docs/superpowers/specs/2026-10-10-idx03-design.md、docs/superpowers/plans/2026-10-10-idx03.md、本文件。
