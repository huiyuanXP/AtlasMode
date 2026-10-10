import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "../i18n/index.js";
import { ConfigurationProjectGraphPanel } from "./ConfigurationProjectGraphPanel.js";
import type { ConfigurationProjectGraph } from "@codemap/core";

const graph: ConfigurationProjectGraph = {
  version: 1,
  status: "partial",
  counts: {
    observedRoots: 1,
    observedProjects: 2,
    observedReferences: 1,
    sourceScopes: 63,
    resolved: 62,
    unconfigured: 1,
    ambiguous: 0,
    invalid: 0,
  },
  roots: ["tsconfig.json"],
  projects: [
    { configPath: "tsconfig.json", status: "invalid" },
    { configPath: "configs/原名.json", status: "resolved" },
  ],
  references: [
    {
      sourceConfigPath: "tsconfig.json",
      referencePathPreview: "./missing",
      targetConfigPath: "missing/tsconfig.json",
      status: "unavailable",
      reason: "Original captured diagnosis",
      referencePathTruncated: false,
      reasonTruncated: false,
    },
  ],
  scopes: [
    {
      sourcePath: "app/原名.ts",
      configPath: "configs/原名.json",
      status: "resolved",
    },
  ],
  truncated: { roots: false, projects: false, references: false, scopes: true },
};
const render = (
  value?: ConfigurationProjectGraph,
  locale: "en" | "zh" = "en",
) =>
  renderToStaticMarkup(
    <LocaleProvider locale={locale}>
      <ConfigurationProjectGraphPanel graph={value} />
    </LocaleProvider>,
  );
describe("IDX03 configuration project graph disclosure", () => {
  it("states legacy metadata was not recorded rather than claiming zero", () => {
    const html = render();
    expect(html).toContain("Configuration project graph was not recorded");
    expect(html).not.toContain("0/0");
  });
  it("renders actual counts, partial status and bounded returned scope sample", () => {
    const html = render(graph);
    expect(html).toContain("Partial captured graph");
    expect(html).toContain("63");
    expect(html).toContain("62");
    expect(html).toContain("1/63");
    expect(html).toContain("Source scope samples");
    expect(html).toContain(
      "A sample was returned; omitted sources retain their recorded scope.",
    );
  });
  it("preserves authored paths and original failed-edge reason in both languages", () => {
    for (const locale of ["en", "zh"] as const) {
      const html = render(graph, locale);
      expect(html).toContain("app/原名.ts");
      expect(html).toContain("Original captured diagnosis");
      expect(html).toContain("missing/tsconfig.json");
    }
  });
  it("translates graph controls and statuses without translating authored paths", () => {
    expect(render(graph)).toContain("Configuration project graph");
    expect(render(graph, "zh")).toContain("配置项目图");
    expect(render(graph, "zh")).toContain("未配置");
    expect(render(graph, "zh")).toContain("不可用");
  });
  it("shows explicit preview and reason truncation", () => {
    const value = structuredClone(graph);
    value.references[0]!.referencePathTruncated = true;
    value.references[0]!.reasonTruncated = true;
    expect(render(value).match(/Text truncated/g)).toHaveLength(2);
  });
  it("discloses every collection omission separately", () => {
    const value = structuredClone(graph);
    value.truncated = {
      roots: true,
      projects: true,
      references: true,
      scopes: true,
    };
    expect(render(value).match(/A sample was returned/g)).toHaveLength(4);
  });
  it("keeps recorded complete status separate from individual scope uncertainty", () => {
    const value = structuredClone(graph);
    value.status = "complete";
    value.scopes = [{ sourcePath: "a.ts", status: "ambiguous" }];
    value.counts.ambiguous = 1;
    value.counts.resolved = 61;
    const html = render(value);
    expect(html).toContain("Captured graph complete");
    expect(html).toContain("Ambiguous");
  });
});
