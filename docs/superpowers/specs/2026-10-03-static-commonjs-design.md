# 捕获包scope与静态 CommonJS 设计 v1

日期2026-10-03 UTC。captured-tsconfig 已于 ec1e375 完整闭环并归档，本轮从这个提交开始。
用户无人值守授权持续至明确收尾；不push/publish，不操作全局客户端。

## 目标与选择

当前产品已实际复现：exports.help覆盖后及require参数遮蔽时，checker仍把mod.help()
连接原helper；稳定CommonJS导出未被标记为入口。先纠正错误肯定关系，再为明确的
静态Node CommonJS入口与调用提供证据；不声称模拟运行时或完整Flow/值分析。

采用捕获AST+包scope+保守绑定注册表。仅信checker已被negativecontrol否定；执行
require/读取已安装依赖违反非执行、离线及输入边界，均不采用。workspace exports/
emit映射另票；本轮只捕获package模式所需manifest，不构建workspace解析器。

## 输入与兼容

package.json为初次扫描allowedPaths里的普通元数据，沿源码相同ignore/exclusion/
symlink/root规则；专门捕获，严格JSON。预算262144B/文件4194304B总量512文件，
与tsconfig预算独立；相同path已作extends配置捕获时复用同一bytes，不重复读。
将现有安全reader提取到单责内部模块供两者调用，不复制完整read/stat/confinement
逻辑。保持既有262144/4194304/512/16配置边界及opaque配置诊断语义。

新增可选coverage.packageFiles:string[]，旧snapshot可读，无数据库迁移；与源码及
configurationFiles计数分离。package bytes（包括invalid JSON）加入versioned source/
configuration/package hash；只改type也staleplan/route，旧snapshot/approval不重写，
函数ID保持原规则。成功capture以外的拒绝bytes不读/不用于推断，拒绝诊断纳入facts。

ignored/unreadable/symlink/nonregular/预算拒绝的枚举package种子，诊断保留opaque
最近package scope；invalid JSON/type同样unknown，不使用祖先。host不读根外祖先。

## 模式和支持子集

.cjs明确CommonJS；.mjs明确ESM，不能将require当Nodeglobal。.js必须有捕获root内
最近有效package：type=commonjs或无type并无ESM语法，采用标准Node静态语义；
type=module/未知type/无scope证据/ESM语法存在则不正向假定CommonJSglobal。
.jsx/TS文件require首轮不正向支持；ESM import及原TS配置语义继续。未知/不支持
require派生调用必须防止已有checker假阳性被接受，但不改变普通ESM/direct调用。

支持顶层单次稳定exports.name=function/arrow/声明，以及module.exports={对象
shorthand/显式函数属性}或函数声明/const callable。规范初始链赋值
exports=module.exports=createApplication明确支持；任意后续混合替换不支持。
importer支持unshadowed literal require、const namespace/destructured/directbinding
和字面量属性选择。var/let importer仍unknown；不得取消既有mutableinitializerguard。

以真实词法Symbol/AST声明识别遮蔽；require/exports/module局部变量、参数、import
等不是Nodebuiltin。重复/compound/delete/conditional/computed导出写入、namespace
成员写入、alias escape、不支持的导出表达式或不确定循环，拒绝相关肯定映射。
拒绝模块整体或单export的策略由下文正式约束与plan固定，不在实现期间增宽。
只允许实际captured implementation的声明身份；不凭函数名匹配，不用callable类型
证明值。函数声明/const callable本身若被可见写入影响，也不得假定初始值。

公共checker的require字面量Symbol可提供captured SourceFile（已probe），但必须
在mode/lexical/stabilityguard之后使用；shadowedcase也有这个Symbol，不能绕过guard。
无captured模块或配置映射目标时relative/configuredalias unknown，bareexternal按既有
规则。无需新增resolver public接口；若Task2最终接口不足，先停下记录具体风险。

## 产品行为

稳定exported函数出现在入口候选，浏览require import/call到真实helper及源码行。
未知关系在相同图/详情有理由，HTTP/MCP/UI共享一份snapshot和生命周期；无新tool/
endpoint/approval。导航中文“包配置”、英文“Package manifests”与相对路径/count；
legacy缺字段标记未记录。技术名/路径/用户文字保持不翻译。核心安装后浏览离线。

## 分阶段验收

1. 包capture/schema/mode/hash：精确预算、opaque最近manifest、root边界、strictJSON、
   type-onlyrefresh、oldschema、metadata/source分离，真实allowed-path sentinel。
2. 绑定safety/entry：现有两个产品negativecases变unknown；stable.cjscontrol及
   supported.jsrootpackage、inline/object/canonicalchain正例精确AST身份；overwrites/
   shadowing/escape/ESM/no-scope/var/let/ambient/type-only negativecontrols。
3. 实际compiledHTTP+SDK+browser：entry→helper源码、unknown原因/metadata双语/历史
   staleness一致。固定Express5.2.1 dbac741a49a5a64336b70c06e85c2e2706e36336只做
   source产品浏览、搜索及源码可见；canonicalentry自动标记原要求未满足，见下方裁决。
   legacyvar/dynamicmixins保持unknown，不要求
   全部运行时关系resolved；不安装/执行target/upstreamtests。
4. 有意义TDD RED/GREEN、相关checks、最终一次root integratedsuite、截图实际查看、
   console/protocol/externaldeny/ownedcleanup，逐任务独立review及最终wholeplan gate。

## 停止与回退

需要复杂值流或运行时才能确认时缩回unknown并记录具体证据，不引入分析引擎。
回退正向解析也保留negativeguard；绝不清库或删除unique知识/批准来消除不一致。
正式plan已完成Task2接口、拒绝粒度/模式边界及GlobalConstraints/producer-consumerpreflight。
Task1/2已独立批准，Task3已提交888386e并完成实现者验证；Task3独立审查与whole-plan仍待完成。

## 自检后明确的拒绝粒度

采用逐导出property拒绝，整体identity损坏时整模块拒绝。单次不支持属性值仅使
该property未知；同property重复/compound/delete写入拒绝该property。未知computed
key、module.exports身份替换/不明混合赋值、exports/module对象escape、词法identity
遮蔽使该module全部CJS映射未知。这样Express的externalbodyParser属性不会否定
稳定createApplication默认函数，但module identity/escape仍保守拒绝。
importer namespace/memberwrite/escape可影响共享moduleproperty，跨consumer同样
不能接受被影响property的旧checker值；const/destructure不会自动撤销target侧拒绝。
显式static module.exports=require('./local')的单次default re-export可作为有限扩展，
只递归验证registry identity且检测环，最终plan明确不纳入，显示未知，不用包入口文件形态猜createApplication。
Canonical lib函数的隔离诊断不能替代完整固定仓库验收。

## 2026-10-03 Express 验收范围裁决（保留原失败）

原要求“完整Express的canonicalentry可见”实际FAIL：固定完整仓库中
lib/express.js:36–56 的createApplication exported=false。index.js:11的
module.exports=require('./lib/express')转发将leaf namespace传给不支持的赋值，
触发已约定的整模块escape拒绝。仅package+lib副本显示true，加回原index后同FnID变false；
这只是定因诊断，不能作为成熟目标通过证据，不修改或缩减固定目标。

controller在新独立审查前明确接受本轮保守限制：实际HTTP/browser/SDK的完整仓库
索引、搜索、源码及预算浏览已通过；自动canonical-entry要求仍未达成。
本轮成熟目标验收按上述完整浏览及诚实unknown收口，不扩大分析器或放松escape规则。
代价是用户需手动搜索入口；静态转发的alias与跨consumer mutation传播另立优先票据，
在本轮whole-plan关闭后实施。原失败、完整目标JSON、裁决和next-ticket必须保留。
另有一次规划E2E退出超时、单次未改源码重试通过，原因未明，由独立审查裁定，不能称已修复。

稳定ID补充：不为新增export理解重写原declaration qualifiedName/身份算法；CJS exportalias先保留在真实import/call/源码证据中。命名函数保留源码名称，匿名实现可沿用既有anonymous名称，不能为了正例搜索方便改变原节点身份。正式验收以实际声明ID/path/line及exposedflag为准，未知/限制如实记录。

交付优先级补充：正式plan先处理已复现的绑定安全及显式.cjs子集，再接包manifest/.js模式及正向入口，最后做公共产品验收。这样用户中途通知收尾时，错误肯定关系的修复优先形成可审查提交；metadata-only中间阶段不会先交付仍有已知错误的Node绑定。精确顺序/内部modeprovider接口须在正式preflight写清。

模式最终候选：.cjs格式按显式扩展名选择CommonJS，.mjs选择ESM，与manifest可用性独立；manifest拒绝诊断仍可见，不推导实际模块可成功加载。普通.js最近opaque/invalid/no-root-scope一律unknown。任何静态resolved只保证支持子集的声明证据，运行兼容性仍人工确认，不声称目标编译/运行已成功。

## 正式约束与自检结论

- Node 24.19.0、npm 11.9.0、Python >=3.10；现有 TypeScript 5.9.3、ts-morph 27.0.2；不新增依赖或改变 lockfile/vendor。
- 仅当前隔离 checkout 顺序 SDD；不 push/publish，不修改全局客户端配置。
- 只分析捕获字节和 AST；不执行目标代码、require、插件、脚本，不读取目标 node_modules、网络或真实 compiler filesystem。
- 包预算独立：262144 bytes/file、4194304 total bytes、512 files；配置原预算及16层边界保持。
- 相同 ignore/allowedPaths/root/symlink 边界；拒绝的最近配置/包 scope 不回退祖先；历史 SQLite、审批和函数 ID 不重写。
- 界面中文默认、英文适配；源码函数名、路径和用户文字保留；元数据不成为源码节点/计数。
- 动态或证据不足的调用明确 unresolved；静态 resolved 不等于运行时兼容或目标构建成功。
- 每任务独立审查；最后一次整体审查、唯一修复波次及唯一限定复审；已通过的检查只因改变/失败/具体疑点重跑。

最终选择：不支持 module.exports=require(...) 转发，不做递归值流或循环导出求值；显示未知并记录原因。
默认模式仅 .cjs=commonjs、.mjs=esm，其他 unknown；Task2通过包证据提供.js模式。
单次 canonical exports=module.exports=函数 是允许的初始化；之后根身份替换/逃逸或未知computed写入整模块拒绝。
已知property重复/compound/delete/条件写入拒绝该property，不误伤其他稳定property。
被捕获 importer 的namespace成员写入影响整个共享目标property；escape或未知property写入影响模块整体。
模块名和词法symbol必须同时验证；require字面量SourceFile符号只提供模块身份，不能证明值稳定。
ESM导入被拒绝的CJS导出也必须走同一安全registry，不能绕过guard。

自检：三个实现任务均有独立可运行交付；公共Graph/HTTP/MCP结构保持，只有可选coverage.packageFiles新增。
Task1内部mode hook是Task2唯一语义连接；Task2sharedreader重构范围仅元数据capture。
所有拒绝粒度、格式边界、版本hash、兼容和测试归属均已在正式plan固定。
用户已授权无人值守自行选择稳定方案，依AGENTS.md不等待阶段确认；本自检不是独立代码审查。
