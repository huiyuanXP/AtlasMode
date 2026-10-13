# 旧夹具扩大 noEmit 记录

`http-window-types-fixtures1.txt` 是额外扩大到旧 src / e2e / integration 夹具的失败检查，不是生产接线检查。原有 package tsconfig 排除 src 测试。旧 helper 的 Fastify payload unknown overload、direct-loop any/spy overload、production.mjs 无声明、ES2024 Promise.withResolvers、e2e optional 访问错误保持原状；见 `legacy-fixture-types-original/` 的 HEAD 原字节、SHA 和 `legacy-fixture-types-ports-only.diff`，相关 helper 与断言未变，仅获授权的 constructor port 与政策 CAS 夹具注入。

没有通过放宽 TS strict、改变全局配置、断言过滤或关闭 DAG 来隐藏失败。生产接线、新 HTTP tests、POL helpers 的独立 noEmit 通过 `http-window-types-production2.txt`，最终依赖冻结后会定向复验。旧夹具运行与 lint 另有真实回执，不能将其解释为旧夹具全量 TypeScript PASS。
