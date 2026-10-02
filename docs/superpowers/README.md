# AtlasMode 的 Superpowers 工作流

本项目按用户要求，将 [obra/superpowers](https://github.com/obra/superpowers)
的 **v6.4.2** 完整技能目录纳入版本管理。来源提交：
`8ca22dba9a94f28898bbce59f2537ff4d87c747d`。

## 安装方式与后续调用

- `.agents/skills/`：上游全部 15 个技能，以及配套脚本、参考资料、审查提示。
- 根 `AGENTS.md`：后续 Codex 会话的入口，要求先读取 `using-superpowers`。
- 根 `CLAUDE.md`：Claude Code 项目入口，读取同一份约束与对应客户端工具映射。
- `upstream.json`：固定版本与来源；`vendor.sha256`：全部技能文件的 SHA-256。
- `LICENSE.superpowers`：保留上游 MIT 版权和许可；不替换 AtlasMode 的许可证。

这是项目内的技能安装，随 Git checkout 保留，无需下载依赖。没有注册全局
marketplace 插件，也没有改动个人 Codex 配置。Codex 的仓库技能目录使用
`.agents/skills/`；已打开会话的技能清单可能尚未重新加载，此时按照 AGENTS.md
直接读取技能文件，即可执行同一工作流。新的会话应以本仓库作为工作目录。
Claude Code 可从根 CLAUDE.md 进入同一流程；其原生插件/自动技能注册尚未验证。
其他助手必须支持 AGENTS.md 或等价的项目指令，才能沿用此入口。

例如需要规划功能时，读取 `.agents/skills/brainstorming/SKILL.md`；已确认设计
后读取 `.agents/skills/writing-plans/SKILL.md`。上游完整工作流保持原样，云端
隔离、实际工具映射和产品约束在 AGENTS.md 中说明。

## 采用的开发流程

1. Brainstorming：先确认目标、约束与成功标准，一次提出一个问题；比较方案。
2. 分段讨论设计，保存书面 spec，完成用户审阅。
3. Writing plans：列出有文件路径、验收和执行命令的小任务；用户审阅并选择执行方式。
4. 按计划执行：TDD 的 RED → GREEN → REFACTOR；子代理执行与审查，或同会话执行后独立审查。
5. 失败时先系统诊断；完成前运行验证，最后按 finishing 流程交付。

不要把 ticket 清单或口头范围选择当作已批准的书面设计与实施计划。
工作流安装后已根据用户问卷开始 T01–T08 实施。T01 工具链与核心模型已通过独立
复审，T02 索引器实施中；完整产品尚未验收。当前决策、授权与下一步见 `state.md`。

## 验证与升级

在仓库根目录运行：

```bash
sha256sum --check docs/superpowers/vendor.sha256
```

这验证安装内容与本次记录的上游文件摘要一致，不是应用测试，也不证明新会话
已自动调用了技能。来源已通过 Git HTTPS 从上游指定 tag 获取，并核对了 HEAD；
未声称上游提交具有签名认证。

升级须先检查上游变更，再选择明确 tag 和完整 commit SHA；在仓库外临时获取
上游，将完整 skills 目录与其 LICENSE 更新到上述位置，更新 upstream.json
及全部文件摘要。审阅 diff 并重新检查技能发现，单独提交版本更新。
不得自动 git pull 跟随 main，不得覆盖项目自身的技能目录或丢弃自定义技能。

在后续 Codex Cloud 任务中复用已有 checkout；未获用户明确要求时不另建 worktree。

## 本次验证结果

- 15 个技能入口与 74 个技能及配套文件已与固定上游提交逐字节比对。
- SHA-256 清单包含上述 74 个文件及上游许可证，全部通过。
- 已通过本会话直接读取 using-superpowers、Codex 工具映射、brainstorming
  与 verification-before-completion，采用项目入口执行后续流程。
- 当前会话的 executor 技能目录未列出项目技能。额外启动 Codex app-server
  以验证 skills/list 自动发现时，先遇到只读全局 SQLite 状态目录；临时
  SQLite 路径解决该项后，仍遇到云端进程初始化的只读文件系统限制。
  因此没有宣称新会话的自动技能清单或 marketplace 注册已验证。
  AGENTS.md 明确保留直接读取技能的入口，后续会话可照此使用。
- 安装提交本身没有应用代码；后续 T01 已完成 core 51 项测试、构建、类型检查与 lint。
  产品运行与跨层验收另记在 state.md 和后续环境报告，不与技能文件校验混为一谈。
