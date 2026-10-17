import { test, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, readFile, stat, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startProduction, denyExternalRequests } from "../support/production.mjs";

// Deterministic fake CLIs on PATH: codex is logged in, claude is installed but logged out.
const features = [
  "shell_tool","shell_snapshot","shell_snapshot_v2","daemon_auto_start","unified_exec","code_mode",
  "code_mode_host","browser_use","browser_use_external","browser_use_full_cdp_access","in_app_browser",
  "computer_use","apps","plugins","hooks","multi_agent","multi_agent_v2","image_generation","view_image",
  "skill_search","skill_mcp_dependency_install","workspace_dependencies","artifact","remote_plugin",
].map((f) => `${f}  stable  false`).join("\\n");
const codex = `#!/bin/sh
case "$1" in
  --version) echo "codex-cli 9.9.9-fake";;
  login) echo "Logged in using ChatGPT";;
  features) printf "${features}\\n";;
  exec) echo "--json --ignore-user-config --ignore-rules --ephemeral --sandbox";;
esac
`;
const claude = `#!/bin/sh
case "$1" in
  --version) echo "9.9.9 (Fake Claude)";;
  auth) echo '{"loggedIn": false}'; exit 1;;
esac
`;

test("settings dialog detects CLIs, connects with one click, stores API key privately", async ({ page, context }) => {
  const root = await mkdtemp(join(tmpdir(), "atlas-settings-e2e-"));
  const bin = join(root, "bin"),
    home = join(root, "codex-home"),
    data = join(root, "data");
  await mkdir(bin);
  await mkdir(home);
  await writeFile(join(bin, "codex"), codex);
  await writeFile(join(bin, "claude"), claude);
  await chmod(join(bin, "codex"), 0o755);
  await chmod(join(bin, "claude"), 0o755);
  const saved = { K: process.env.OPENAI_API_KEY, PATH: process.env.PATH, CODEX_HOME: process.env.CODEX_HOME, P: process.env.CODEMAP_AGENT_PROVIDER };
  const external: string[] = [],
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await denyExternalRequests(context, external);
  let server;
  try {
    process.env.PATH = `${bin}:${saved.PATH}`;
    process.env.CODEX_HOME = home;
    delete process.env.CODEMAP_AGENT_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    server = await startProduction(data);
  } finally {
    process.env.PATH = saved.PATH;
    if (saved.K !== undefined) process.env.OPENAI_API_KEY = saved.K;
    if (saved.CODEX_HOME === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = saved.CODEX_HOME;
    if (saved.P !== undefined) process.env.CODEMAP_AGENT_PROVIDER = saved.P;
  }
  try {
    await page.goto(server.url);
    await page.getByRole("button", { name: /设置/ }).click();
    const dialog = page.getByRole("dialog", { name: "Agent 设置" });
    await expect(dialog).toBeVisible();
    const codexCard = dialog.locator('[data-provider="codex"]'),
      claudeCard = dialog.locator('[data-provider="claude"]');
    await expect(codexCard).toContainText("已登录，可直接连接");
    await expect(codexCard).toContainText("9.9.9-fake");
    await expect(claudeCard).toContainText("已安装，但未登录");
    await expect(claudeCard).toContainText("claude auth login");
    await expect(claudeCard).not.toContainText("Run `");
    await expect(claudeCard.getByRole("button", { name: "一键连接" })).toBeDisabled();
    await page.screenshot({ path: "artifacts/e2e/settings-dialog.png" });

    // One click connects; the dialog reports the real status.
    await codexCard.getByRole("button", { name: "一键连接" }).click();
    await expect(dialog.locator(".settings-result")).toContainText("已连接");
    await expect(codexCard).toContainText("当前");
    expect(JSON.parse(await readFile(join(data, "agent-settings.json"), "utf8")).provider).toBe("codex");

    // API card: validation, then key is stored 0600 and never shown again.
    const api = dialog.locator('[data-provider="responses"]');
    await api.getByRole("button", { name: "保存并连接" }).click();
    await expect(dialog.locator(".settings-result")).toContainText("需要填写模型和 API Key");
    await expect(api).not.toContainText("已保存");
    await api.getByLabel("模型").fill("test-model");
    await api.getByRole("button", { name: "保存并连接" }).click();
    await expect(dialog.locator(".settings-result")).toContainText("需要填写模型和 API Key");
    await api.getByLabel("API 地址").fill("http://example.com/v1");
    await api.getByLabel("API Key").fill("sk-e2e-secret");
    await api.getByRole("button", { name: "保存并连接" }).click();
    await expect(dialog.locator(".settings-result")).toContainText("保存失败");
    await api.getByLabel("API 地址").fill("http://127.0.0.1:9/v1");
    await api.getByRole("button", { name: "保存并连接" }).click();
    await expect(dialog.locator(".settings-result")).toContainText("已连接");
    await expect(api).toContainText("已保存");
    await expect(api.getByLabel("API Key")).toHaveValue("");
    expect((await stat(join(data, "agent-settings.json"))).mode & 0o777).toBe(0o600);
    expect(await page.content()).not.toContain("sk-e2e-secret");
    const response = await page.request.get(`${server.url}/api/agent/settings`);
    expect(await response.text()).not.toContain("sk-e2e-secret");

    // Closing refreshes the chat panels with the saved provider.
    await dialog.getByRole("button", { name: "关闭", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const status = await (await page.request.get(`${server.url}/api/agent/status`)).json();
    expect(status).toMatchObject({ provider: "responses", available: true, model: "test-model" });

    // Reload keeps the choice (persisted server-side).
    await page.reload();
    await page.getByRole("button", { name: /设置/ }).click();
    await expect(dialog.locator('[data-provider="responses"]')).toContainText("当前");
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  } finally {
    await server?.stop();
    await rm(root, { recursive: true, force: true });
  }
});
