const read = [
  "list_projects",
  "get_project_summary",
  "search_functions",
  "get_function_context",
  "get_subgraph",
  "get_routes",
  "get_groups",
  "get_folder_policies",
  "list_plans",
  "get_plan",
];
export function mcpChannelTools(channel: string): readonly string[] {
  if (channel === "explore" || channel === "plan")
    return [
      ...read,
      "propose_route",
      "propose_plan",
      "update_plan",
      "validate_plan",
      "propose_group",
      "get_approved_plan",
      "refresh_index",
      "verify_implementation",
    ];
  throw new Error("CODEMAP_MCP_CHANNEL must be explore or plan.");
}
