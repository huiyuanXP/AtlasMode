# Global Constraints — verbatim

- Node24.19.0/npm11.9.0/Python>=3.10，现有TS5.9.3/ts-morph27.0.2；不新增依赖、改lockfile/vendor。
- 使用当前隔离checkout顺序SDD；无push/publish/全局客户端配置；实现者不派助手或审查者。
- 只处理捕获字节、AST和已捕获checker声明；不执行目标代码、require、插件、脚本、upstream或读取node_modules/root外/compiler真实FS。
- 当前包/配置预算、16层配置边界、ignore/allowedPaths/root/symlink/opaque scope保持；转发最多16边，17边拒绝。
- actual叶声明名称/路径/行/ID保留；imports为物理转发目标；v3字节hash不升版，旧snapshot/approval不重写。
- 中文默认/英文及只读源码保留；事实不足/动态/循环/escape为unknown，static resolved不等于runtime/build兼容。
- 每任务独立审查；任务修复最多五轮；最后ONE整体审查/ONE集中修复/ONE限定复审/逐项残留裁决。
- 已通过检查仅因改变/失败/具体疑点重跑；root内部重建dist，root/browser顺序；不重跑未改变Vite/Flask。
