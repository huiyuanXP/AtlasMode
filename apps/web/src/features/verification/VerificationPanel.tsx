import type { VerificationReport } from "@codemap/core";
import { useStrings } from "../../i18n/index.js";
export function VerificationPanel({
  report,
  onVerify,
  disabled,
}: {
  report?: VerificationReport;
  onVerify: () => void;
  disabled: boolean;
}) {
  const zh = useStrings();
  return (
    <section>
      <h2>{zh.verifyTab}</h2>
      <p className="muted">{zh.noReport}</p>
      <p className="muted">{zh.verifyHistorical}</p>
      <button disabled={disabled} onClick={onVerify}>
        {zh.verify}
      </button>
      {report && (
        <>
          <p>
            {zh.reportRevision}: r{report.revision}
          </p>
          <code className="path">{report.snapshotId}</code>
          {report.items.map((item, i) => (
            <article className={`verification ${item.status}`} key={i}>
              <strong>
                {zh[item.status]} · #{item.operationIndex + 1}
              </strong>
              <p>{item.message}</p>
              <ul>
                {item.evidence.map((e, j) => (
                  <li key={j}>
                    <code>{e}</code>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </>
      )}
    </section>
  );
}
