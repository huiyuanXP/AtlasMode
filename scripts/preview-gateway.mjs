// Temporary preview gateway for a loopback-only AtlasMode backend (VM testing through a tunnel).
// - requires a secret token (first visit /?t=TOKEN sets an HttpOnly cookie);
// - rewrites Host for the backend's local-authority check;
// - only lets Settings choose a local CLI provider (never an API URL/key) and only the allowed project open.
// Usage: PREVIEW_TOKEN=... PREVIEW_BACKEND_PORT=44320 PREVIEW_PORT=44321 PREVIEW_PROJECT=/abs/path node scripts/preview-gateway.mjs
import http from "node:http";
import { timingSafeEqual } from "node:crypto";

const token = process.env.PREVIEW_TOKEN ?? "";
const backendPort = Number(process.env.PREVIEW_BACKEND_PORT);
const port = Number(process.env.PREVIEW_PORT);
const allowedProject = process.env.PREVIEW_PROJECT;
if (token.length < 24 || !backendPort || !port) {
  console.error("PREVIEW_TOKEN (>=24 chars), PREVIEW_BACKEND_PORT and PREVIEW_PORT are required.");
  process.exit(1);
}
const same = (a, b) => {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const deny = (res, code, message) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify({ code: "PREVIEW_DENIED", message }));
};
const cookieName = "atlas_preview";
http
  .createServer((req, res) => {
    let url;
    try {
      url = new URL(req.url, "http://x");
    } catch {
      return deny(res, 400, "bad url");
    }
    const supplied = url.searchParams.get("t");
    if (supplied && same(supplied, token)) {
      res.writeHead(302, {
        "set-cookie": `${cookieName}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/`,
        location: url.pathname,
      });
      return res.end();
    }
    const cookie = (req.headers.cookie ?? "")
      .split(/;\s*/)
      .find((c) => c.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    if (!cookie || !same(cookie, token)) return deny(res, 401, "Preview token required.");
    if (req.headers.origin) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host) return deny(res, 403, "foreign origin");
      } catch {
        return deny(res, 403, "bad origin");
      }
    }
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      let pathname = url.pathname;
      try {
        pathname = decodeURIComponent(pathname);
      } catch {
        return deny(res, 400, "bad path");
      }
      if (req.method === "POST" && pathname === "/api/projects") {
        let path;
        try {
          path = JSON.parse(body.toString()).path;
        } catch {}
        if (!allowedProject || path !== allowedProject) return deny(res, 403, "Only the preview project may be opened.");
      }
      if (req.method === "PUT" && pathname === "/api/agent/settings") {
        let input;
        try {
          input = JSON.parse(body.toString());
        } catch {}
        const ok =
          input &&
          ["off", "codex", "claude"].includes(input.provider) &&
          input.apiBaseUrl === undefined &&
          input.apiKey === undefined &&
          input.model === undefined;
        if (!ok) return deny(res, 403, "Preview only allows choosing off/codex/claude; API URL, key and model are blocked.");
      }
      const headers = { ...req.headers, host: `127.0.0.1:${backendPort}` };
      delete headers.origin;
      delete headers.cookie;
      delete headers["x-forwarded-for"];
      const up = http.request({ host: "127.0.0.1", port: backendPort, method: req.method, path: req.url, headers }, (r) => {
        res.writeHead(r.statusCode, r.headers);
        r.pipe(res);
      });
      up.on("error", () => deny(res, 502, "backend unavailable"));
      up.end(body);
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`preview gateway on 127.0.0.1:${port} -> ${backendPort}`));
