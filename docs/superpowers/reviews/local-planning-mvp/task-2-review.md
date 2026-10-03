### Spec Compliance

- ❌ Issues found: Python 局部绑定漏收集并用最终绑定反向解析先前调用，会制造 resolved 调用事实（`packages/indexer/python/index.py:113`、`:121`、`:62`）；匿名 TS 回调把调用表达式原文嵌入身份，表达式中的空行改变函数 ID（`packages/indexer/src/typescript.ts:61`）。这两项分别违反未知调用保守保留与空行编辑后身份稳定要求。
- ✅ 其余可由 diff 验证的 T02 范围已实现：无参 SourceIndexer、core 公共入口消费、捕获源码驱动 TS/JS/Python 静态分析、导入/重导出、关系证据、coverage/diagnostics、Git 只读 revision、可选 readSource 以及 helper 打包。授权的 core port/manifest 和三个 controller 文档提交没有被当作额外产品功能（`packages/indexer/src/index.ts:1`、`:10`、`:22`、`:39`；`packages/core/src/model.ts:157`；`packages/indexer/package.json:14`）。
- ⚠️ Cannot verify from diff: Linux 外的 native Windows/macOS Python discovery、跨平台 symlink 行为、超时/异常进程清理和大型真实项目规模没有本任务执行证据；报告诚实标为未执行，当前不构成跨平台成功宣称。后续平台/规模验收由 controller 按计划执行。T03–T08 的 service、storage、HTTP、UI 和 MCP 行为不属于此审查。

### Strengths

- `packages/indexer/src/index.ts:22`：graph、捕获和两语言分析器状态按调用创建；`packages/indexer/src/typescript.ts:15` 使用内存文件系统，避免 compiler 自行读取目标配置或额外源码。
- `packages/indexer/src/scan.ts:51`、`:67`：readSource 执行 realpath 范围检查后用打开的 regular-file handle 读取；scanner 和 parser/hash 共享捕获字节，编码转换不重新读取目标文件。
- `packages/indexer/python/index.py:133`、`:136`：base64 字节经标准库 AST parse，目标模块没有 import/exec 路径；`packages/indexer/src/python.ts:74` 的 helper URL 相对模块定位，不依赖 cwd。manifest 的 dist/python files 声明与报告的真实 tar 包消费证据相符。
- `packages/indexer/src/index.test.ts:1`：新增测试调用真实 SourceIndexer、临时源码和 fixtures，覆盖别名/重导出、动态调用、空行、源码读取及并发项目隔离。实现报告提供实际 RED 行为失败与 GREEN 72 tests 输出，并明确区分后续平台/规模检查；本审查没有重跑通过的套件。

### Issues

#### Critical (Must Fix)

- 无。

#### Important (Should Fix)

1. **Python 绑定收集不完整且缺少保守的绑定时序处理。** `packages/indexer/python/index.py:113` 只通过 Name(Store/Del) 识别普通赋值，`packages/indexer/python/index.py:121` 的 Lambda visitor 仅绑定 posonly/普通/kwonly 参数，遗漏 vararg/kwarg；except handler 与 match capture 使用字符串名字，也不会触发 visit_Name。`packages/indexer/python/index.py:62` 把后来的 def 写入同一 scope，随后所有保存的调用按最终 bindings 解析。

   实际影响：`def target(): pass` 存在时，`except Exception as target: target()`、`case target: target()`、`lambda *target: target()` 全被误解析为全局 target；这些实际绑定分别是异常、捕获值和 tuple，不是该函数。`def caller(): target(); def target(): pass` 的先前调用被误解析为 caller.target，实际该位置局部 target 尚未绑定。这会让图与后续规划核对把不存在的实现调用当作确定事实。

   修复：补全 ExceptHandler、pattern capture 和 lambda vararg/kwarg 等绑定形式；对可能重绑定或执行前未绑定的名字保持 unknown，或引入有证据的时序/definite-binding 分析。加入这些最小反例回归，保留普通明确 direct call 的 resolved 行为。

2. **匿名回调身份含有空白敏感源码文本。** `packages/indexer/src/typescript.ts:61` 用 `node.parent.expression.getText()` 构造 `<callback:...:argumentIndex>`，之后 `packages/indexer/src/typescript.ts:104` 将该 name 纳入 qualifiedName 和节点 ID。

   实际影响：`items\n.map(() => target())` 与 `items\n\n.map(() => target())` 的 AST/语义相同，但 callee 原文不同，匿名回调 ID 随单独插入空行改变；其内部调用的 sourceId 也改变，使绑定该函数的注释、分组或路线失去关联。当前稳定性测试仅给整个文件开头加空行，不能覆盖此失效方式。

   修复：以不含 trivia 的 AST token/结构路径和参数位置构造 callback 名称；不要把 getText 原文直接用作身份。增加在 callee 表达式内部插入空行的 ID 稳定性回归。

#### Minor (Nice to Have)

- 无额外建议；先修复上述事实正确性与身份要求。

### Assessment

**Task quality:** Needs fixes

**Reasoning:** 包边界、捕获字节、静态解析进程及真实 fixtures 验证组织合理；但漏掉 Python 影子绑定会制造调用事实，匿名回调原文身份会破坏空行稳定性，T02 当前尚不能作为后续规划核对的可信事实层。

**Check run:** 完整指定 diff 分三段各读一次，没有重新生成 diff、没有另读 changed production files、没有遍历全仓、没有修改源码/index/HEAD、没有派遣子代理。唯一命名的聚焦探针风险为“Python 静态绑定是否会制造确定调用”；Node spawnSync 向 `python3 -I packages/indexer/python/index.py` 传入五份单文件 JSON/base64 字节（exception、lambda_vararg、pattern、late_local、正常 direct call 对照），不落盘、不执行任何目标 Python。前三项返回 `target=[sample.py,target]`，late_local 返回 `[sample.py,caller.target]`，正常对照返回 `[sample.py,target]`，均无 diagnostics，exit 0（tool chunk `c7e5de`）。没有额外范围外生产代码检查或套件运行。只写入本 ignored 审查 artifact。
