import { expect, test, vi } from "vitest";
import { StructureClient, StructureClientError } from "./structure-client.js";
const capture = {
  mutationId: "00000000-0000-4000-8000-000000000001",
  expectedStructureRevision: 4,
  expectedFileDigest: "a".repeat(64),
};
test("legacy POST sends only explicit captured CAS and keeps DB-only same id", async () => {
  const fetcher = vi.fn(async (_path: RequestInfo | URL, _init?: RequestInit) =>
    Response.json({ id: "db-only" }),
  );
  const api = new StructureClient(fetcher);
  await api.savePolicy("project/a", {
    ...capture,
    id: "db-only",
    pathPrefix: "src",
    purpose: "retain",
    forbiddenDependencies: ["internal"],
  });
  expect(fetcher.mock.calls[0]).toEqual([
    "/api/projects/project%2Fa/policies",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...capture,
        id: "db-only",
        pathPrefix: "src",
        purpose: "retain",
        forbiddenDependencies: ["internal"],
      }),
    },
  ]);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
test("structure transport has real preview/import and explicit conflict acceptance paths", async () => {
  const fetcher = vi.fn(async (_path: RequestInfo | URL, _init?: RequestInit) =>
    Response.json({}),
  );
  const api = new StructureClient(fetcher);
  await api.readState("p", true);
  await api.readPolicies("p");
  await api.preview("p");
  await api.writeStructure("p", {
    ...capture,
    operation: { kind: "importLegacy" },
  });
  expect(fetcher.mock.calls.map((c) => c[0])).toEqual([
    "/api/projects/p/structure?acceptExternalConflict=1",
    "/api/projects/p/policies?includeStructure=1",
    "/api/projects/p/structure/legacy-preview",
    "/api/projects/p/structure",
  ]);
  expect(
    JSON.parse((fetcher.mock.calls[3]?.[1] as RequestInit).body as string)
      .operation,
  ).toEqual({ kind: "importLegacy" });
});
test("HTTP conflict diagnostics propagate and never trigger hidden reads or retry", async () => {
  const fetcher = vi.fn(async (_path: RequestInfo | URL, _init?: RequestInit) =>
    Response.json(
      {
        code: "STRUCTURE_CONFLICT",
        message: "changed",
        diagnostics: [
          { pointer: "/folders", kind: "schema", message: "invalid" },
        ],
      },
      { status: 409 },
    ),
  );
  const api = new StructureClient(fetcher);
  await expect(
    api.writeStructure("p", {
      ...capture,
      operation: { kind: "importLegacy" },
    }),
  ).rejects.toMatchObject({
    status: 409,
    code: "STRUCTURE_CONFLICT",
    diagnostics: [{ pointer: "/folders", kind: "schema", message: "invalid" }],
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(StructureClientError).toBeDefined();
});
