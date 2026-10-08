const zh = {
  explore: "探索代码",
  plan: "讨论规划",
  connected: "本机 Agent 已就绪",
  disconnected: "本机 Agent 未连接",
  setup: "使用本机 Codex / Claude 的已有账号或 API/Profile 配置后重试。",
  checking: "正在检查本机连接…",
  retry: "检查连接",
  send: "发送",
  cancel: "停止",
  cancelling: "正在停止…",
  thinking: "正在处理你的请求…",
  completed: "已完成",
  cancelled: "已停止",
  failed: "请求未完成",
  you: "你",
  assistant: "Agent",
  input: "向 Agent 提问",
  exploreHint: "例如：这个项目的请求重试从哪里开始？",
  planHint: "例如：新增 fetchNotes，并复用已有的请求重试。",
  exploreEmpty: "描述你想了解的代码，我会结合当前项目和位置探索。",
  planEmpty: "描述你想实现的行为，让 Agent 提出可查看、可调整的规划。",
  limit: "每条消息最多 4096 字符。",
  partial: "可能已保存部分变更，请检查当前项目的规划。",
  saved: "规划变更已保存。",
  conflict:
    "项目或规划版本已更新，请刷新项目并重新载入规划后重试；输入已保留。",
  syncFailed: "读取最新变更失败，请刷新项目后检查规划。",
  unavailable: "本机 Agent 暂不可用，请检查已有账号或 API/Profile 配置。",
  busy: "这个项目已有请求运行中，请等待完成后重试。",
  connectionError: "本机连接中断，请检查服务后重试；你的输入已保留。",
  runFailed: "请求未完成；你的输入已保留，可检查连接后重试。",
  activity: "请求进度",
  generic: "处理项目请求",
  summary: "读取项目概况",
  search: "查找函数",
  context: "读取函数上下文",
  graph: "查看局部关系",
  groups: "查看功能集",
  policies: "查看目录职责",
  propose: "提出规划草稿",
  update: "更新规划草稿",
  validate: "检查规划",
  approved: "读取用户确认版本",
  group: "整理功能集",
  refresh: "刷新代码索引",
  verify: "核对实现证据",
  routes: "查看浏览路线",
  route: "整理浏览路线",
  plans: "读取规划列表",
  readPlan: "读取规划变更",
  projects: "读取当前项目",
  changes: "规划概览",
  advanced: "高级编辑",
  source: "查看源码",
  noPlan: "描述需求以开始规划，或打开高级编辑手动创建。",
  changed: "项变更",
  noChanges: "暂无语义变更",
  missingFunction: "已有函数",
  relation: "已有关系",
  maxHistory: "仅展示最近 20 轮对话。",
};
const en: Record<keyof typeof zh, string> = {
  explore: "Explore code",
  plan: "Discuss a plan",
  connected: "Local Agent ready",
  disconnected: "Local Agent disconnected",
  setup:
    "Use your existing local Codex / Claude account or API/Profile configuration, then retry.",
  checking: "Checking local connection…",
  retry: "Check connection",
  send: "Send",
  cancel: "Stop",
  cancelling: "Stopping…",
  thinking: "Working on your request…",
  completed: "Completed",
  cancelled: "Stopped",
  failed: "Request incomplete",
  you: "You",
  assistant: "Agent",
  input: "Message Agent",
  exploreHint: "For example: where does request retry start?",
  planHint: "For example: add fetchNotes and reuse request retry.",
  exploreEmpty:
    "Describe the code you want to understand. The current project and location provide context.",
  planEmpty:
    "Describe the behavior you want. The Agent can propose a plan you can inspect and adjust.",
  limit: "Messages can contain at most 4096 characters.",
  partial: "Changes may have been saved. Check the current project plans.",
  saved: "Plan changes saved.",
  conflict:
    "Project or plan context changed. Refresh the project and reload the plan, then retry; your input is retained.",
  syncFailed:
    "Could not read the latest changes. Refresh the project and inspect the plan.",
  unavailable:
    "Local Agent unavailable. Check your existing account or API/Profile configuration.",
  busy: "A request is already running for this project. Wait and retry.",
  connectionError:
    "Local connection interrupted. Check the service and retry; your input is retained.",
  runFailed:
    "Request incomplete. Your input is retained; check the connection and retry.",
  activity: "Request progress",
  generic: "Working with this project",
  summary: "Read project overview",
  search: "Find functions",
  context: "Read function context",
  graph: "Inspect local relations",
  groups: "Read function groups",
  policies: "Read directory responsibilities",
  propose: "Propose a draft plan",
  update: "Update a draft plan",
  validate: "Check a plan",
  approved: "Read user-confirmed revision",
  group: "Organize function groups",
  refresh: "Refresh code index",
  verify: "Check implementation evidence",
  routes: "Read browse routes",
  route: "Organize browse routes",
  plans: "Read plan list",
  readPlan: "Read plan changes",
  projects: "Read current project",
  changes: "Plan overview",
  advanced: "Advanced editing",
  source: "View source",
  noPlan:
    "Describe your goal to start a plan, or open advanced editing to create one manually.",
  changed: "changes",
  noChanges: "No semantic changes yet",
  missingFunction: "Existing function",
  relation: "Existing relation",
  maxHistory: "Showing the most recent 20 conversation turns.",
};
export const chatStrings = (locale: "zh" | "en") => (locale === "zh" ? zh : en);
export function activityLabel(tool: string, locale: "zh" | "en") {
  const s = chatStrings(locale);
  const map: Record<string, string> = {
    get_project_summary: s.summary,
    search_functions: s.search,
    get_function_context: s.context,
    get_subgraph: s.graph,
    get_groups: s.groups,
    get_folder_policies: s.policies,
    propose_plan: s.propose,
    update_plan: s.update,
    validate_plan: s.validate,
    get_approved_plan: s.approved,
    propose_group: s.group,
    refresh_index: s.refresh,
    verify_implementation: s.verify,
    list_routes: s.routes,
    get_routes: s.routes,
    propose_route: s.route,
    list_plans: s.plans,
    get_plan: s.readPlan,
    list_projects: s.projects,
  };
  return map[tool] ?? s.generic;
}
export function chatErrorLabel(code: string, locale: "zh" | "en") {
  const s = chatStrings(locale);
  if (code === "AGENT_UNAVAILABLE" || code.includes("AUTH"))
    return s.unavailable;
  if (code === "AGENT_BUSY" || code === "AGENT_LIMIT") return s.busy;
  if (
    code.includes("CONFLICT") ||
    code === "PROJECT_MISMATCH" ||
    code === "NOT_FOUND"
  )
    return s.conflict;
  if (code === "CHAT_SYNC_FAILED") return s.syncFailed;
  if (code.includes("CONNECTION") || code === "CHAT_CANCEL_FAILED")
    return s.connectionError;
  return s.runFailed;
}
