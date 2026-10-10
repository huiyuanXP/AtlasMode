# configCapture Windows CI 38070834961 fixture 窄修复交付

作者 /root/idx01_impl，原 gpt-6.1-sol high。仅修改 packages/indexer/src/configCapture.test.ts；无生产修改/build/root tests/stage/commit/push/spawn。AG03 设计暂后排。

## 冻结来源

- BASE commit: c9b9206cb83f8bc440aa386140247b08a0eaa734
- 旧 fixture SHA256: 63ee995288c11508671b23c434218c43c1a4673e1137718003b2e058efdcb869
- 新 fixture SHA256: d7a97f244028f7529ca3d87c0cb3944b3bdc53a94d30070572862d2fb2fab7ad
- patch SHA256: deb6ed9711c3a197da7de67ea079ac8d9da5330b37356c8a62ffeee13f8b06e6
- configCapture.before.test.ts / configCapture.after.test.ts 是精确字节备份；旧备份已与 git show BASE:path 逐字节一致。
- freeze-manifest.json 保存全部日志 SHA；production-source-before/after.json 的16个 indexer生产文件逐项相同。
- 原始 Windows FAIL完整日志 windows-ci-original-FAIL.log，SHA 84225397ea16881b7528e43c203fd8084467a146c94fac28c1fd5c588c9b9151；保留原5000ms timeout和ENOTEMPTY，未覆盖为PASS。

## 定位与最小修复

原 Windows run: configCapture25项中512 case 5088ms timeout5000ms，afterEach同case ENOTEMPTY；513 case2480ms成功。全Windows test阶段76文件通过/1失败/1跳过，861tests通过/1失败/18跳过（880）。Linux/macOS/browser通过由main掌握，不冒称本机重验。

旧 fixture 在 test body 内按每个文件重复 mkdir + serial writeFile。512项约1024次串行异步文件操作；Vitest超时不取消async函数，afterEach可在其仍写入时删除根目录。原日志没有setup/capture阶段profiling，不能把5088ms全称setup测量；ENOTEMPTY与继续写入的代码时序一致。本Linux基线仍25/25 PASS，边界两例894/736ms（包含旧setup）。生产 capture 是read-only，产品预算262144单文件、4194304总字节、512文件完全未改。

修复只fixture:
1. parent directory去重，最多4个并发writer；allSettled等每个worker结束后再抛原write错误，生产capture仍串行原实现。
2. 记录每个完整owned fixture Promise，cleanup先drain再rm、之后才reset既有mockOpen；调用方仍收到原fixture错误，不以cleanup的allSettled替代失败断言。
3. describe.each(count)显式闭包，beforeEach创建对应512/513真实文件，测试体仅真实capture及全部原边界断言。没有task.name解析、timeout参数、testTimeout/hookTimeout配置、native skip或重试删除掩盖竞态。
4. 本文件唯一新增回归：8个真实file write，显式barrier扣住其余writer、first writer抛OWNED_FIXTURE_WRITE_FAILURE；证明失败未让fixture/cleanup提前结束，peak=4，8个write全部结束，active=0，root已删除。无sleep/timing阈值；setImmediate只排空promise reactions。finally只收口本测试资源。

## RED / GREEN / scoped检查

- 原真实RED：windows-ci-original-FAIL.log。
- Linux旧基线：npx vitest run packages/indexer/src/configCapture.test.ts --reporter=verbose →25PASS；linux-baseline.log（不称Windows复现）。
- 新drain回归负控：仅临时将worker Promise.allSettled改Promise.all；定向drains测试真实FAIL expected true to be false。drain-failfast-RED.log 与负控源码保留；Python finally立即还原；这是假设负控，不冒称原Windows源码。
- 最终GREEN：npx vitest run packages/indexer/src/configCapture.test.ts --reporter=verbose →26PASS，3.55s；final-26-GREEN.log。
- 最终Linux边界/新回归时长（新边界不含beforeEach准备，不能与旧总时长直接比较）:
 ✓ packages/indexer/src/configCapture.test.ts > captured configuration inputs > drains bounded fixture writers after a real write failure before cleanup 21ms
 ✓ packages/indexer/src/configCapture.test.ts > captured configuration inputs > 512 eligible configuration seeds > enforces the 512 file limit for 512 eligible seeds 580ms
 ✓ packages/indexer/src/configCapture.test.ts > captured configuration inputs > 513 eligible configuration seeds > enforces the 512 file limit for 513 eligible seeds 425ms
- npx eslint packages/indexer/src/configCapture.test.ts → exit0；final-scoped-lint.log。
- npx tsc -p packages/indexer/tsconfig.json --noEmit → exit0；scoped-noEmit.log（此包配置排除tests）。
- npx tsc -p /tmp/atlas-configcapture-ci-38070834961/fixture-noEmit-tsconfig.json --noEmit → exit0；fixture-noEmit.log（owned配置明确包含此测试，亦核其source imports）。

## 留待主控

以BASE c9+ONLY frozen fixture 建隔离archive，独立high review、实际native Windows CI；未证明Windows当前PASS，不关闭原FAIL，不带入其它未完成产品窗口。没有公共文档或票状态更新。冻结后本作者不再写该fixture。
