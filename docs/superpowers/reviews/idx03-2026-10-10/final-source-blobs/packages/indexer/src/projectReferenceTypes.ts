export type {
  ConfigurationScopeStatus,
  ConfigurationProjectGraph,
} from "@codemap/core";
import type { ConfigurationScopeStatus } from "@codemap/core";
export type SourceConfigurationScope = {
  sourcePath: string;
  configPath?: string;
  status: ConfigurationScopeStatus;
};
