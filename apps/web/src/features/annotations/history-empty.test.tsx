import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AnnotationHistoryView } from "./AnnotationHistoryView.js";
import { scope } from "./fixtures.test-support.js";
test.each(["zh", "en"] as const)("%s empty history is 0–0 / 0", (locale) => {
  const html = renderToStaticMarkup(
    <AnnotationHistoryView
      scope={scope}
      locale={locale}
      history={{
        scope,
        annotationId: "n",
        status: "ready",
        value: { items: [], total: 0, offset: 0, limit: 20, truncated: false },
      }}
      onPage={() => {}}
    />,
  );
  expect(html).toContain("0–0 / ");
  expect(html).not.toContain("1–0");
});
