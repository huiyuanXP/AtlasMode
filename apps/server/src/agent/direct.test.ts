import { expect, test } from "vitest";
import { createResponsesRunner } from "./direct.js";
const key = "test-only-not-a-real-credential";
const env = { CODEMAP_AGENT_MODEL: "fixture-model", OPENAI_API_KEY: key };
test("configuration status is server-only and does not require CLI or query provider", async () => {
  const status = await createResponsesRunner(env).status();
  expect(status).toMatchObject({
    provider: "responses",
    configured: true,
    available: true,
    model: "fixture-model",
    authentication: "api-environment",
  });
  expect(JSON.stringify(status)).not.toContain(key);
  expect(JSON.stringify(status)).not.toContain("api.openai.com");
});
test.each([
  {},
  { CODEMAP_AGENT_MODEL: "fixture-model" },
  { ...env, CODEMAP_AGENT_API_BASE_URL: "http://example.com/v1" },
  {
    ...env,
    CODEMAP_AGENT_API_BASE_URL: "https://user:password@example.com/v1",
  },
  { ...env, CODEMAP_AGENT_API_BASE_URL: "https://example.com/v1?secret=foo" },
  { ...env, CODEMAP_AGENT_API_KEY_ENV: "BAD-NAME" },
])(
  "invalid or missing trusted configuration is unavailable without secrets",
  async (invalid) => {
    const status = await createResponsesRunner(invalid).status();
    expect(status.available).toBe(false);
    expect(JSON.stringify(status)).not.toContain(key);
  },
);
