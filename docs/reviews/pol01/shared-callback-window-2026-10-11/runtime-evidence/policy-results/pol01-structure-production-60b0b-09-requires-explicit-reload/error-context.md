# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pol01-structure.spec.ts >> production native policy edit/import retains unsent input and actual 409 requires explicit reload
- Location: tests/e2e/pol01-structure.spec.ts:37:1

# Error details

```
AssertionError: {"status":400,"body":{"code":"INVALID_INPUT","message":"Invalid request.","issues":[{"path":["positions"],"message":"Invalid input: expected record, received undefined"},{"path":["theme"],"message":"Invalid option: expected one of \"light\"|\"dark\""}]}}
```

# Test source

```ts
  119 |       structureFiles: new StructureFileStore(),
  120 |     });
  121 |     project = await service.openProject(projectPath);
  122 |     storage.put("policies", legacyId, {
  123 |       id: legacyId,
  124 |       projectId: project.id,
  125 |       pathPrefix: "src",
  126 |       purpose: "DB original",
  127 |       forbiddenDependencies: ["vendor"],
  128 |     });
  129 |   } finally {
  130 |     storage.close();
  131 |   }
  132 |   const records: Record<string, unknown>[] = [];
  133 |   const connections: (() => Promise<void>)[] = [];
  134 |   let active: Awaited<ReturnType<typeof start>> | undefined;
  135 |   const env: Record<string, string> = {
  136 |     ...process.env,
  137 |     TSX_TSCONFIG_PATH: config,
  138 |     CODEMAP_DATA_DIR: data,
  139 |     CODEMAP_WORKSPACE_ROOT: "",
  140 |   };
  141 |   if (env.NO_COLOR !== undefined) delete env.FORCE_COLOR;
  142 |   async function start() {
  143 |     const port = await freePort(),
  144 |       url = `http://127.0.0.1:${port}`;
  145 |     const args =
  146 |       mode === "source"
  147 |         ? ["--import", "tsx", resolve("apps/server/src/index.ts")]
  148 |         : [resolve("apps/server/dist/index.js")];
  149 |     const child = spawn(process.execPath, args, {
  150 |       env: { ...env, CODEMAP_PORT: String(port) },
  151 |       stdio: ["ignore", "pipe", "pipe"],
  152 |     });
  153 |     let output = "";
  154 |     child.stdout.on("data", (bytes) => {
  155 |       output += bytes;
  156 |     });
  157 |     child.stderr.on("data", (bytes) => {
  158 |       output += bytes;
  159 |     });
  160 |     const exit = once(child, "exit");
  161 |     let stopped = false;
  162 |     const stop = async () => {
  163 |       if (stopped) return;
  164 |       stopped = true;
  165 |       if (child.exitCode === null && child.signalCode === null)
  166 |         child.kill("SIGTERM");
  167 |       const force = setTimeout(() => child.kill("SIGKILL"), 10000);
  168 |       let result;
  169 |       try {
  170 |         result = await exit;
  171 |       } finally {
  172 |         clearTimeout(force);
  173 |       }
  174 |       const closed = await portClosed(port);
  175 |       records.push({
  176 |         kind: "server",
  177 |         mode,
  178 |         pid: child.pid,
  179 |         port,
  180 |         exit: result,
  181 |         portClosed: closed,
  182 |         output,
  183 |       });
  184 |       assert.deepEqual(result, [0, null], output);
  185 |       assert.equal(closed, true, "owned API port must close");
  186 |     };
  187 |     try {
  188 |       const deadline = Date.now() + 15000;
  189 |       while (
  190 |         Date.now() < deadline &&
  191 |         child.exitCode === null &&
  192 |         child.signalCode === null
  193 |       ) {
  194 |         try {
  195 |           if ((await fetch(`${url}/api/health`)).ok) return { url, port, stop };
  196 |         } catch {
  197 |           /* bounded startup poll */
  198 |         }
  199 |         await delay(40);
  200 |       }
  201 |       throw new Error(`Owned ${mode} API startup failed: ${output}`);
  202 |     } catch (error) {
  203 |       await stop();
  204 |       throw error;
  205 |     }
  206 |   }
  207 |   active = await start();
  208 |   async function raw<T>(suffix: string, method = "GET", body?: unknown) {
  209 |     assert(active);
  210 |     const response = await fetch(active.url + suffix, {
  211 |       method,
  212 |       headers: { "content-type": "application/json" },
  213 |       ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  214 |     });
  215 |     return { status: response.status, body: (await response.json()) as T };
  216 |   }
  217 |   async function json<T>(suffix: string, method = "GET", body?: unknown) {
  218 |     const response = await raw<T>(suffix, method, body);
> 219 |     assert(
      |     ^ AssertionError: {"status":400,"body":{"code":"INVALID_INPUT","message":"Invalid request.","issues":[{"path":["positions"],"message":"Invalid input: expected record, received undefined"},{"path":["theme"],"message":"Invalid option: expected one of \"light\"|\"dark\""}]}}
  220 |       response.status >= 200 && response.status < 300,
  221 |       JSON.stringify(response),
  222 |     );
  223 |     return response.body;
  224 |   }
  225 |   async function mcp() {
  226 |     assert(active);
  227 |     const transport = new StdioClientTransport({
  228 |       command: process.execPath,
  229 |       args:
  230 |         mode === "source"
  231 |           ? ["--import", "tsx", resolve("apps/mcp/src/index.ts")]
  232 |           : [resolve("apps/mcp/dist/index.js")],
  233 |       env: {
  234 |         ...env,
  235 |         CODEMAP_API_URL: active.url,
  236 |         CODEMAP_MCP_PROJECT_ID: project.id,
  237 |       },
  238 |       stderr: "pipe",
  239 |       cwd: process.cwd(),
  240 |     });
  241 |     let stderr = "";
  242 |     transport.stderr?.on("data", (chunk) => {
  243 |       stderr += chunk;
  244 |     });
  245 |     const client = new Client({
  246 |       name: "pol01-owned-stdio-acceptance",
  247 |       version: "1.0.0",
  248 |     });
  249 |     let closed = false;
  250 |     const stop = async () => {
  251 |       if (closed) return;
  252 |       closed = true;
  253 |       const pid = transport.pid;
  254 |       await client.close();
  255 |       for (let tries = 0; tries < 25 && !pidAbsent(pid); tries++)
  256 |         await delay(40);
  257 |       const absent = pidAbsent(pid);
  258 |       records.push({ kind: "mcp-stdio", mode, pid, pidAbsent: absent, stderr });
  259 |       assert.equal(absent, true, "owned SDK stdio child must exit");
  260 |     };
  261 |     connections.push(stop);
  262 |     await client.connect(transport);
  263 |     return {
  264 |       client,
  265 |       stop,
  266 |       call: async <T>(name: string, args: Record<string, unknown>) => {
  267 |         const result = await client.callTool({ name, arguments: args });
  268 |         if (!Array.isArray(result.content))
  269 |           throw new Error("Missing MCP content");
  270 |         const block = result.content[0];
  271 |         if (!block || block.type !== "text" || typeof block.text !== "string")
  272 |           throw new Error("Missing MCP text");
  273 |         return {
  274 |           isError: result.isError === true,
  275 |           body: JSON.parse(block.text) as T,
  276 |         };
  277 |       },
  278 |     };
  279 |   }
  280 |   const invariants = async () => {
  281 |     assert.equal(
  282 |       digest(await readFile(source)),
  283 |       sourceDigest,
  284 |       "target source bytes changed",
  285 |     );
  286 |     await assert.rejects(access(marker), { code: "ENOENT" });
  287 |   };
  288 |   const close = async () => {
  289 |     try {
  290 |       for (const stop of connections.splice(0).reverse()) await stop();
  291 |       await active?.stop();
  292 |       await invariants();
  293 |     } finally {
  294 |       await writeFile(
  295 |         join(root, "runtime-receipt.json"),
  296 |         JSON.stringify(
  297 |           {
  298 |             root,
  299 |             database,
  300 |             rootCleanup: "retained-evidence",
  301 |             sourceDigest,
  302 |             records,
  303 |           },
  304 |           null,
  305 |           2,
  306 |         ),
  307 |       );
  308 |       console.info(
  309 |         JSON.stringify({
  310 |           receipt: "POL01_SQLITE_STDIO_OWNED",
  311 |           root,
  312 |           runtime: join(root, "runtime-receipt.json"),
  313 |           records,
  314 |           rootCleanup: "retained-evidence",
  315 |         }),
  316 |       );
  317 |     }
  318 |   };
  319 |   return {
```