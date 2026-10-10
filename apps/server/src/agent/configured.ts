import { createNativeRunner } from "./native.js";
import { createResponsesRunner } from "./direct.js";
import type { AgentRunner } from "./types.js";

/** Only the trusted server launch environment selects the provider. */
export function createConfiguredRunner(
  env: NodeJS.ProcessEnv = process.env,
): AgentRunner {
  return env.CODEMAP_AGENT_PROVIDER === "responses"
    ? createResponsesRunner(env)
    : createNativeRunner(env);
}
