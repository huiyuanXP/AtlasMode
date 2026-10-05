import type { VerificationReport } from '@codemap/core';
export function VerificationPanel({
  report,
}: {
  report: VerificationReport | null;
}) {
  return (
    <section>
      <h2>实现核对</h2>
      <p>
        重新索引真实源码，对照用户确认的版本检查。结构核对不能替代功能测试。
      </p>
      {report ? (
        <>
          <p>
            规划 v{report.planRevision} · 快照 <code>{report.snapshotId}</code>
          </p>
          <details>
            <summary>规划临时符号到真实符号的绑定</summary>
            {Object.entries(report.bindings)
              .filter(([id]) => id.startsWith('plan:'))
              .map(([id, target]) => (
                <p key={id}>
                  <code>{id}</code> → <code>{target ?? '无法唯一绑定'}</code>
                </p>
              ))}
          </details>
          <ul className="record-list">
            {report.items.map((item, index) => (
              <li key={index} className={`verification-${item.status}`}>
                <strong>
                  {item.status === 'satisfied'
                    ? '已满足'
                    : item.status === 'unsatisfied'
                      ? '未满足'
                      : '无法判定'}{' '}
                  · {item.description}
                </strong>
                <p>{item.reason}</p>
                {item.evidence.map((evidence, i) => (
                  <small key={i}>
                    {evidence.fileId} : {evidence.range.startLine}–
                    {evidence.range.endLine}
                    <br />
                  </small>
                ))}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="muted">选择已有人工审批的规划，执行“重新索引并核对”。</p>
      )}
    </section>
  );
}
