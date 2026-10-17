import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentStatus } from "../chat/types.js";

export type Provider = "off" | "codex" | "claude" | "responses";
export interface PublicSettings {
  provider: Provider;
  codexProfile?: string;
  model?: string;
  apiBaseUrl?: string;
  apiKeyConfigured: boolean;
  apiKeyEnvironment?: boolean;
}
export interface CliProbe {
  installed: boolean;
  version?: string;
  loggedIn: boolean;
  ready: boolean;
  detail?: string;
  profiles?: string[];
  model?: string;
  modelProvider?: string;
  authentication?: "api-environment" | "openai-account" | "none";
}
export interface ProbeResult {
  platformSupported: boolean;
  codex: CliProbe;
  claude: CliProbe;
}
export interface SettingsPayload {
  provider: Provider;
  codexProfile?: string;
  model?: string;
  apiBaseUrl?: string;
  apiKey?: string | null;
}
export interface SettingsTransport {
  load(): Promise<{ settings: PublicSettings; editable: boolean }>;
  probe(profile?: string): Promise<ProbeResult>;
  save(
    payload: SettingsPayload,
  ): Promise<{ settings: PublicSettings; status: AgentStatus }>;
}
export class SettingsApi implements SettingsTransport {
  constructor(private readonly transport: typeof fetch = fetch) {}
  private async request<T>(path: string, body?: unknown): Promise<T> {
    // Detach first: calling fetch with `this` bound to this object throws "Illegal invocation".
    const transport = this.transport;
    const response = await transport(`/api${path}`, {
      method: body === undefined ? "GET" : "PUT",
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as {
        code?: string;
        message?: string;
      };
      throw Object.assign(new Error(error.message ?? `HTTP ${response.status}`), {
        code: error.code,
      });
    }
    return response.json() as Promise<T>;
  }
  load = () => this.request<{ settings: PublicSettings; editable: boolean }>("/agent/settings");
  probe = (profile?: string) =>
    this.request<ProbeResult>(
      "/agent/probe" + (profile ? `?profile=${encodeURIComponent(profile)}` : ""),
    );
  save = (payload: SettingsPayload) =>
    this.request<{ settings: PublicSettings; status: AgentStatus }>(
      "/agent/settings",
      payload,
    );
}

const text = {
  zh: {
    title: "Agent 设置",
    checking: "正在检测本机 CLI…",
    recheck: "重新检测",
    close: "关闭",
    locked: "当前服务由启动环境固定了 Agent 配置，这里只能查看。",
    unsupported: "原生 CLI 在 Windows 上暂不支持；可使用下方 API。",
    codex: "Codex CLI",
    claude: "Claude Code CLI",
    api: "Responses API",
    off: "关闭 Agent",
    notInstalled: "未安装",
    notLoggedIn: "已安装，但未登录",
    loginCodex: "请在终端运行 `codex login`，或在下方选择 API Profile，然后点「重新检测」",
    loginClaude: "请在终端运行 `claude auth login`，然后点「重新检测」",
    ready: "已登录，可直接连接",
    useIt: "一键连接",
    connected: "已连接",
    profile: "Codex Profile",
    defaultProfile: "默认配置",
    model: "模型",
    baseUrl: "API 地址",
    baseUrlHint: "默认 https://api.openai.com/v1；兼容服务需 https（本机可用 http）。",
    key: "API Key",
    keySaved: "已保存（不会显示）。留空保留，填写则替换。",
    keyEnvironment: "服务启动环境已提供 API Key；留空则使用它，填写则改存你输入的 Key。",
    keyHint: "仅保存在本机数据目录（权限 600），不会回传到浏览器。",
    clearKey: "清除已保存的 Key",
    saveApi: "保存并连接",
    current: "当前",
    result: "连接结果",
    failed: "保存失败",
    offDone: "Agent 已关闭",
    apiNeed: "需要填写模型和 API Key。",
  },
  en: {
    title: "Agent settings",
    checking: "Checking local CLIs…",
    recheck: "Check again",
    close: "Close",
    locked: "The server launch fixes the Agent configuration; it is read-only here.",
    unsupported: "Native CLIs are not supported on Windows yet; use the API below.",
    codex: "Codex CLI",
    claude: "Claude Code CLI",
    api: "Responses API",
    off: "Turn Agent off",
    notInstalled: "Not installed",
    notLoggedIn: "Installed, not logged in",
    loginCodex: "Run `codex login` in a terminal, or pick an API profile, then press Check again",
    loginClaude: "Run `claude auth login` in a terminal, then press Check again",
    ready: "Logged in — ready to connect",
    useIt: "Connect",
    connected: "Connected",
    profile: "Codex profile",
    defaultProfile: "Default configuration",
    model: "Model",
    baseUrl: "API base URL",
    baseUrlHint: "Default https://api.openai.com/v1; compatible services need https (http on loopback).",
    key: "API key",
    keySaved: "Saved (never shown). Leave empty to keep, type to replace.",
    keyEnvironment: "The server launch environment already provides a key; leave empty to use it, or type one to store your own.",
    keyHint: "Stored only in the local data directory (mode 600); never sent back to the browser.",
    clearKey: "Clear saved key",
    saveApi: "Save and connect",
    current: "Current",
    result: "Connection result",
    failed: "Save failed",
    offDone: "Agent turned off",
    apiNeed: "Model and API key are required.",
  },
};
export type SettingsText = (typeof text)["zh"];

export interface SettingsDialogProps {
  api: SettingsTransport;
  locale: "zh" | "en";
  open: boolean;
  onClose: () => void;
  /** Called after a successful save so chat panels re-read the agent status. */
  onApplied: () => void;
}
export function SettingsDialog({
  api,
  locale,
  open,
  onClose,
  onApplied,
}: SettingsDialogProps) {
  const t = text[locale];
  const ref = useRef<HTMLDialogElement>(null);
  const [probe, setProbe] = useState<ProbeResult>();
  const [settings, setSettings] = useState<PublicSettings>();
  const [editable, setEditable] = useState(true);
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [profile, setProfile] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [key, setKey] = useState("");
  const run = useCallback(
    async (p?: string) => {
      setBusy("probe");
      try {
        const [loaded, probed] = await Promise.all([api.load(), api.probe(p)]);
        setSettings(loaded.settings);
        setEditable(loaded.editable);
        setProbe(probed);
        setProfile((cur) => cur || loaded.settings.codexProfile || "");
        setModel((cur) => cur || loaded.settings.model || "");
        setBaseUrl((cur) => cur || loaded.settings.apiBaseUrl || "");
      } catch (error) {
        setMessage((error as Error).message);
      } finally {
        setBusy(undefined);
      }
    },
    [api],
  );
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal?.();
      setMessage(undefined);
      void run();
    }
    if (!open && dialog.open) dialog.close?.();
  }, [open, run]);
  const apply = async (payload: SettingsPayload, label: string) => {
    setBusy(label);
    setMessage(undefined);
    try {
      const result = await api.save(payload);
      setSettings(result.settings);
      setKey("");
      setMessage(
        payload.provider === "off"
          ? t.offDone
          : result.status.available
            ? t.connected
            : (result.status.reason ?? t.failed),
      );
      onApplied();
    } catch (error) {
      setMessage(`${t.failed}: ${(error as Error).message}`);
    } finally {
      setBusy(undefined);
    }
  };
  const cliLine = (c: CliProbe | undefined, hint: string) =>
    !c
      ? t.checking
      : !c.installed
        ? t.notInstalled
        : c.ready
          ? t.ready
          : c.detail
            ? c.detail
            : `${t.notLoggedIn}: ${hint}`;
  const active = settings?.provider;
  const disabled = !editable || !!busy;
  return (
    <dialog
      ref={ref}
      className="project-dialog settings-dialog"
      aria-label={t.title}
      onClose={onClose}
    >
      <div className="drawer-heading">
        <h2>{t.title}</h2>
        <button type="button" aria-label={t.close} onClick={onClose}>
          ×
        </button>
      </div>
      {!editable && <p className="warning">{t.locked}</p>}
      {probe && !probe.platformSupported && <p className="warning">{t.unsupported}</p>}
      {busy === "probe" && <p className="muted" role="status">{t.checking}</p>}

      <section className="settings-card" data-provider="codex">
        <h3>
          {t.codex}
          {active === "codex" && <em> · {t.current}</em>}
        </h3>
        <p className={probe?.codex.ready ? "" : "muted"}>
          {cliLine(probe?.codex, t.loginCodex)}
          {probe?.codex.version ? ` · ${probe.codex.version}` : ""}
          {probe?.codex.model ? ` · ${probe.codex.model}` : ""}
        </p>
        {probe?.codex.installed && (
          <label>
            {t.profile}
            <select
              aria-label={t.profile}
              value={profile}
              disabled={disabled}
              onChange={(e) => {
                setProfile(e.target.value);
                void run(e.target.value || undefined);
              }}
            >
              <option value="">{t.defaultProfile}</option>
              {probe.codex.profiles?.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className="primary"
          disabled={disabled || !probe?.codex.ready}
          onClick={() =>
            void apply(
              { provider: "codex", ...(profile ? { codexProfile: profile } : {}) },
              "codex",
            )
          }
        >
          {t.useIt}
        </button>
      </section>

      <section className="settings-card" data-provider="claude">
        <h3>
          {t.claude}
          {active === "claude" && <em> · {t.current}</em>}
        </h3>
        <p className={probe?.claude.ready ? "" : "muted"}>
          {cliLine(probe?.claude, t.loginClaude)}
          {probe?.claude.version ? ` · ${probe.claude.version}` : ""}
        </p>
        <button
          type="button"
          className="primary"
          disabled={disabled || !probe?.claude.ready}
          onClick={() => void apply({ provider: "claude" }, "claude")}
        >
          {t.useIt}
        </button>
      </section>

      <section className="settings-card" data-provider="responses">
        <h3>
          {t.api}
          {active === "responses" && <em> · {t.current}</em>}
        </h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (
              !model.trim() ||
              (!key && !settings?.apiKeyConfigured && !settings?.apiKeyEnvironment)
            ) {
              setMessage(t.apiNeed);
              return;
            }
            void apply(
              {
                provider: "responses",
                model: model.trim(),
                ...(baseUrl.trim() ? { apiBaseUrl: baseUrl.trim() } : {}),
                ...(key ? { apiKey: key } : {}),
              },
              "responses",
            );
          }}
        >
          <label>
            {t.model}
            <input
              aria-label={t.model}
              value={model}
              disabled={disabled}
              onChange={(e) => setModel(e.target.value)}
            />
          </label>
          <label>
            {t.baseUrl}
            <input
              aria-label={t.baseUrl}
              value={baseUrl}
              disabled={disabled}
              placeholder="https://api.openai.com/v1"
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </label>
          <small className="muted">{t.baseUrlHint}</small>
          <label>
            {t.key}
            <input
              aria-label={t.key}
              type="password"
              autoComplete="off"
              value={key}
              disabled={disabled}
              placeholder={settings?.apiKeyConfigured ? "••••••••" : ""}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <small className="muted">
            {settings?.apiKeyConfigured
              ? t.keySaved
              : settings?.apiKeyEnvironment
                ? t.keyEnvironment
                : t.keyHint}
          </small>
          <div className="settings-actions">
            <button className="primary" disabled={disabled}>
              {t.saveApi}
            </button>
            {settings?.apiKeyConfigured && (
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  void apply(
                    {
                      provider: active ?? "off",
                      ...(settings.model ? { model: settings.model } : {}),
                      ...(settings.apiBaseUrl ? { apiBaseUrl: settings.apiBaseUrl } : {}),
                      ...(settings.codexProfile ? { codexProfile: settings.codexProfile } : {}),
                      apiKey: null,
                    },
                    "clear",
                  )
                }
              >
                {t.clearKey}
              </button>
            )}
          </div>
        </form>
      </section>

      <div className="settings-actions">
        <button type="button" disabled={disabled} onClick={() => void apply({ provider: "off" }, "off")}>
          {t.off}
        </button>
        <button type="button" disabled={!!busy} onClick={() => void run(profile || undefined)}>
          {t.recheck}
        </button>
      </div>
      {message && (
        <p role="status" className="settings-result">
          {t.result}: {message}
        </p>
      )}
    </dialog>
  );
}
