
## 限定提交补充：共享 hunks 与冻结 UI 原始字节

主控要求基于 HEAD 619c39a82a4a9d6d3d8c8dec2a8846f7f00d52f2 限定 IDX 提交，材料如下：

- idx03-shared-core-only.patch：仅 model 的 ConfigurationScopeStatus / ConfigurationProjectGraph / optional coverage 字段与 validation 的 graph schema。没有 RecordKind annotations、KN schema、POL字段、core/index.ts出口；无需新增 core export，HEAD barrel 已导出 model/validation。
- idx03-frozen-ui-only.patch：仅冻结 Navigation 两处调用/import 与 en/zh19词条。与后续 FS UI改动分开。
- idx03-submit-whitelist.json：18独占产品/tests/helpers文件、两个shared patch、专属spec/plan/report目录。旧 owned-product.diff 为共享验收状态全diff，含注明的 KN dependency，不应直接拿它代替新的限定提交patch。
- final-source-blobs/：source-freeze40全部原始字节按repo path留存，每个SHA重新核对一致。Nav/i18n冻结字节已可复现，不会将FS后续修改纳入本票原冻结收据。
- shared-patch-check.log：以独立临时 GIT_INDEX_FILE 的 read-tree(base) 做 git apply --cached --check，两patch通过；没有触碰实际index、gitadd或提交。

**独立构建边界**：本票最终 scoped core build 是共享worktree构建，core/src/index.ts 当时有另票未提交出口 ./structure-types.js、./structure.js、./annotations.js，完整对应 files 均存在；core tsconfig include src/**/*.ts，因此这些另票文件也被编译。这三出口与 RecordKind annotations 不是IDX03产品依赖，IDX新源码依赖的core符号仅graph model types、normalizeRepoPath及既有schema/模型通路；新panel只type-import ConfigurationProjectGraph。没有运行独立clean IDX-only candidate build，不能将共享scoped PASS称为隔离IDX-only PASS。

主控可从明确base仅取新core/UI patches与独占白名单（保留HEAD core/index.ts三个既有出口，不取KN/POL新文件/出口/RecordKind行）构建clean候选；它的build/CI结果由主控新阶段记录。现有40source/79compiled真实gate及SHA保持原样，不被重新解释为该未来候选门禁。
