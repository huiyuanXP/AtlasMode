<!-- atlasmode-v1:indexing -->

## 实现

新增 indexer workspace，通过 core port 使用。扫描固定授权根目录，读取 tsconfig、Git revision 与内容摘要，记录纳入/排除范围，校验真实路径和符号链接归属。解析声明、命名箭头、表达式、类方法和匿名回调；处理 import alias/re-export；文件/目录/外部包作为真实节点。

## 验收

- [ ] 自动扫描 TS/JS/TSX/JSX，真实节点、calls/imports/contains 与源码范围可查询。
- [ ] 跨文件/别名/re-export fixture 调用端点准确，递归允许。
- [ ] 动态/无法解析的调用保存 unresolved 原因，不被省略或推测为事实。
- [ ] 空行不改变符号 ID；重命名/移动是候选迁移，不能静默重绑知识。
- [ ] 未提交源码修改改变 baseline digest；增删文件刷新正确。
- [ ] .git/node_modules/dist/缓存/显式排除不索引；拒绝越界符号链接。
