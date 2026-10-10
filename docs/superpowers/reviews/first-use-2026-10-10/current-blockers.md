# 当前外部验收依赖（2026-10-10）

本文件不替代待办票，也不把尚未实现的代码问题归为外部阻塞。现有36票18DONE、18未完成；GRP02隔离门禁与定向交互复审完成，IDX03/POL01实现中，KN01设计复审通过、新模块实施中；FS01设计复审通过、UI窗口待交接，AG02设计通过但writer未实现。全部7个GitHub Issue仍open。

| 票 | 准确剩余依赖 | 已有证据边界 |
| --- | --- | --- |
| AG05 | 当前SSH启动环境未配置Responses provider/model/key-env；已有异步问题等待用户指定既有配置方式并授权最小真实调用 | HTTP/SSE协议fixture、真实MCP SDK和浏览器通过；不等同实际外部模型调用，未读取密钥/认证配置 |
| QA02 | VM2当前为Linux，指定PATH下找到Codex、未找到Claude命令；仍需Claude真实客户端收据及实际Windows交互Ctrl+C环境 | Windows native CI已通过，但不能替代交互客户端、原历史SIGKILL因果分析 |
| AG03 | Windows所属Job产品机制仍未实现；实际Windows根先退出/持有stdio后代等场景门禁尚未执行 | 现役Windows原生Chat拒绝启动；不能移除guard后称支持，也不能用通用HTTP或native build代替 |
| OPS01 | 全新独立云环境/任务恢复验收未执行；分发/发布需具体结果与最终用户授权 | 本次VM2独立tmp clean归档/安装不是新云恢复，不操作其他服务器 |

SEC01已完成：冻结锁审计0及7528f78远端CI38064184377四job全部成功，提交fe4b52c保存原始收据。首次复用依赖产物build TS2349失败保留且根因未定，之后同冻结源码clean npm ci全部通过；不以clean成功改写失败原因。

临时公网演示已关闭；每次测试使用所属fixture服务器并自行收口。截图/测试报告保留，不删除其他代理进程、标签或工作区；未merge/生产部署/更改权限。
