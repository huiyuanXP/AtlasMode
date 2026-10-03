# 静态 CommonJS 转发安全设计

日期：2026-10-03 UTC。基线：已关闭 CommonJS 归档6c2fc16268ffd523fb40577ed9075dbb393531ec；真实源码15d2c16已通过458/30，旧历史因果缺口及宿主warning保留。用户持续无人值守授权仍有效，本票无发布授权。

## Goal
固定完整Express中的createApplication原自动入口验收失败，原因是root单次
module.exports=require('./lib/express')被视为namespace escape。本票只补这个受限
静态身份关系，让入口/调用保留实际leaf声明；不得删除原失败或放松共享写入保护。
成功后本机Agent可从真实暴露函数入口浏览，规划/批准继续使用同一HTTP/MCP快照。

## 方案选择
继续unknown最安全但不能补首个Node真实入口缺口；模拟require/通用值流违反输入
边界并扩大范围；选择仅捕获AST验证的相对静态转发身份组。无新增依赖/Port/DB/tool。
保留中文/英文UI及路径、源码名称。可扩展性不作为本票目标。

## 支持与拒绝
仅一个有效CJS源文件中的单次顶层未遮蔽module.exports=require(一个相对字面量)（允许等价静态 module["exports"]），
目标须公共checker证明为捕获内SourceFile且有效CJS。该forwarding源不得另有exports/
module.exports写入；叶模块原有函数/对象导出子集保持。require、module符号重写、
unknown/ESM/package拒绝、conditional/repeated/dynamic/external/property转发均unknown。
不支持exports=module.exports=require链、var/let命名空间再转发、运行时loader或workspace。
确切合法转发表达式才可免于escape拒绝；任何其他namespace值使用保持原guard。
新转发必须同时通过当前whole修复的require-cycle标记：即使forwarding有向链本身
无环，只要该require边处于捕获require强连通分量（如leaf再require根forwarder），
也不能证明转发最终身份；禁止用canonical leaf查找消除cyclicInitialization未知。

每模块最多一个forward edge，链至唯一leaf实际导出；限制16条边，环/自环/17条边
不能正向解析。不执行JS、插件或target脚本，不读node_modules/root外/compiler真实FS。

## 身份组与写入
验证身份组后在输出入口/调用前收集所有捕获consumer写入。knownproperty拒绝传播
整组该属性；computed未知/namespace escape/根身份损坏传播整组invalid。修改其中
任何alias不得让另一alias或leaf保留旧肯定映射。ESM default/named/namespace消费
同样受约束，checker不能从leaf声明绕回guard。保守整组拒绝可降低coverage，需要
在reason/限制中说明。callable default Symbol与名称为default的property严格分离。

物理import证据仍指向真实forwarder文件/path/line/text；call目标ID/path指向真实leaf
实现。不能复制函数节点、改qualifiedName/ID或凭函数名猜目标。无相关模块的稳定
函数不受影响。算法遍历顺序不能影响结果；拒绝环/预算必须终止。

## 新鲜度/历史
源码/配置/包bytehash仍v3，无仅为新理解而升版。graphfacts包含入口/关系，因此
相同bytes的新事实产生不同snapshotID，旧规划和路线按现有ID规则stale；声明ID/
历史快照/批准保留。公共数据shape、MCP16工具和UI批准渠道不变。

## 验收候选
1. 真实SourceIndexer RED：两级相对转发后的函数导出入口和callee尚不可用；新理解
   后实际leafID/path/line正向，匿名/对象/默认函数及named.default对照。
2. 安全负例：alias消费者写属性、第二consumer、leaf写入、computed/escape、ESM绕过、
   重复根/遮蔽/动态/不支持转发、modeopaque与excludedleaf；影响映射必须unknown。
3. 16边正例/17边拒绝/环和自环/无关component不误伤，原83身份+9语法及配置包边界
   回归保留。相关core/indexer build/types/rootlint；逐任务独立gate。
4. 公共fixture真实compiledHTTP/SDK/browser：入口→leaf源码、unknown理由、转发更改
   stale且历史/ID保留；双语现有UI无新增技术设置，真实非loopback拒绝和ownedcleanup。
5. changed-analyzer才允许一次新固定完整Express5.2.1dbac741...gate：必须明确断言
   createApplication exported=true且完整entrylist含实际ID，源行36；不能仅genericexit0。
   unique新label，不窄化test/fixtures，不安装/执行target/upstream。若仍失败保留具体因，
   无无限增宽分析器或冒充成功。Vite/Flask不重跑。
6. 最后一次最终组合源码root build/type/lint/test，源码SHA、截图实际看、provenance/
   artifact保存；whole一次审查/一次集中修复/一次限定复审，rulings exhaustive保存。
   根npmtest内部可能重建dist，与browser不得常规并行；首次退出超时若仍未定因须
   继续明确记录，不能由转发positive覆盖该风险。native/client/remoteCI/restore范围如实。

## Producer/consumer 自检与选择

当前私有Module保留source/candidate/invalid/exports/rejected；Binding保留真实module/
property及独立cyclicInitialization。requireBinding先校验词法/源模式/写入/字面量，
公共checker只查已捕获SourceFile；迭代强连通分量在derived const绑定前标记环边。
新alias身份必须建立在这些已验证关系上，不覆盖cycle flag或把reason变成checker回退。
实际imports仍使用物理targetPath；canonical只用于受保护的导出值身份和共享拒绝。
createCommonJsAnalyzer与indexTypeScript内部调用shape保持，无新增公共Port/字段。

纯path/edge身份组可在确有单一职责时提取私有helper，先向controller提交确切方案；
不要求为抽象而拆文件。实现者选择内部名称，不改变public契约。所有捕获消费者
写入/escape在入口及call分类之前整组核对；invalid的forward表达式无escape豁免。
16/17边、自环和require-SCC回边均有明确控制；保守拒绝的覆盖代价公开。

事实fingerprint已含导出/关系，service规划比较snapshotID或contentHash，route校验和UI
也比较snapshotID。无需更改service/hash版号。Task1保留真实实现前SourceIndexer结果，
在相同fixture字节上比较新facts/snapshotID、相同contentHash及声明ID，不能伪造oldbinary。
Task2独立实际HTTP/SDK/SQLite证明alias目标改变后plan/route stale和历史批准不变。

现有mature validator仅泛用浏览，Task2必须新增明确opt-in require-entry验收；选中的真实
node必须exported=true，真实返回entry列表包含其ID，并检查truncation限制。全Express
只跑一次新gate；如果仍失败，保留新实际原因和未满足状态，不以generic exit0冒充成功，
不无限扩大分析范围。上一票的原FAIL永远保留原时间/修订。

## Global Constraints

- Node24.19.0/npm11.9.0/Python>=3.10，现有TS5.9.3/ts-morph27.0.2；不新增依赖、改lockfile/vendor。
- 使用当前隔离checkout顺序SDD；无push/publish/全局客户端配置；实现者不派助手或审查者。
- 只处理捕获字节、AST和已捕获checker声明；不执行目标代码、require、插件、脚本、upstream或读取node_modules/root外/compiler真实FS。
- 当前包/配置预算、16层配置边界、ignore/allowedPaths/root/symlink/opaque scope保持；转发最多16边，17边拒绝。
- actual叶声明名称/路径/行/ID保留；imports为物理转发目标；v3字节hash不升版，旧snapshot/approval不重写。
- 中文默认/英文及只读源码保留；事实不足/动态/循环/escape为unknown，static resolved不等于runtime/build兼容。
- 每任务独立审查；任务修复最多五轮；最后ONE整体审查/ONE集中修复/ONE限定复审/逐项残留裁决。
- 已通过检查仅因改变/失败/具体疑点重跑；root内部重建dist，root/browser顺序；不重跑未改变Vite/Flask。

## Review Focus

1. 有效转发才能豁免namespace escape；conditional/repeated/rewritten/modeunknown/invalid-chain仍拒绝，不能由checker叶声明回绕。
2. alias、leaf及另一消费者共享已知属性拒绝/wholeinvalid，ESM导入同样守护；named.default和callable Symbol不混淆。
3. 16边正例/17边拒绝、自环/多环及leaf再require root的SCC回边；source/遍历顺序无关、终止、无递归loader。
4. 相同真实输入的新facts产生不同snapshotID而v3 contentHash/声明ID保持；actual历史/approve/routes受旧基线约束。
5. 全固定Express gate必须真实检查入口，不窄化target、不把诊断副本当接受；原FAILED状态、原Important退出缺口及所有UNRUN保留。

## Design self-review

在当前CommonJS整轮关闭及恢复校验后正式化；三种方向已比较，选最窄纯AST身份组。
代码producer/consumer和当前cycle flag已实读，公共shape不变；两顺序任务分别拥有
registry安全和actual产品验收。无逐阶段人工等待（用户已授权），无额外spec reviewer。
原Important历史因果缺口不影响静态alias身份证明，但始终保留；不能借新positive掩盖。
设计自检时尚未实现。当前检查点Task1已实现并经独立修复复审通过；Task2公共生命周期/浏览器及完整Express新入口验收未运行，整票未完成。
