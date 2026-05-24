#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { callTruthTool } from "./mcp-tools.js";
import { runReviewWorkflow } from "./web-workflow.js";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_WEB_ROOT = resolve(ROOT, "web");
const DEFAULT_MAX_JSON_BODY_BYTES = 256 * 1024;

export function createWebServer({
  callTool = callTruthTool,
  webRoot = DEFAULT_WEB_ROOT,
  maxJsonBodyBytes = DEFAULT_MAX_JSON_BODY_BYTES
} = {}) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");

      if (request.method === "GET" && url.pathname === "/api/doctor") {
        return sendJson(response, 200, { ok: true, doctor: callTool("doctor.all", { all: true }) });
      }

      if (request.method === "POST" && url.pathname === "/api/review") {
        validateReviewRequest(request);
        const input = await readJsonBody(request, { maxBytes: maxJsonBodyBytes });
        const review = runReviewWorkflow(input, { callTool });
        return sendJson(response, 200, { ok: true, review });
      }

      if (url.pathname.startsWith("/api/")) {
        return sendJson(response, 404, { ok: false, error: "Unknown API endpoint." });
      }

      if (request.method !== "GET") {
        return sendText(response, 405, "Method not allowed");
      }

      return serveStatic(response, webRoot, url.pathname);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = error instanceof HttpError ? error.status : 400;
      return sendJson(response, status, { ok: false, error: message });
    }
  });
}

export function startWebServer({ port = process.env.TRUTH_TOOLS_WEB_PORT ?? process.env.PORT ?? 4173 } = {}) {
  const server = createWebServer();
  server.listen(Number(port), "127.0.0.1", () => {
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    safeWrite(`truth-tools web listening on http://127.0.0.1:${actualPort}\n`);
  });
  return server;
}

async function serveStatic(response, webRoot, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safeRelative = normalize(decodeURIComponent(requested)).replace(/^(\.\.[/\\])+/, "");
  const filePath = resolve(join(webRoot, safeRelative));

  if (!filePath.startsWith(resolve(webRoot))) {
    return sendText(response, 403, "Forbidden");
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, { "content-type": contentType(filePath) });
    response.end(content);
  } catch {
    sendText(response, 404, "Not found");
  }
}

function validateReviewRequest(request) {
  const contentType = String(request.headers["content-type"] ?? "").toLowerCase();
  if (!contentType.split(";")[0].trim().endsWith("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json.");
  }

  if (!isAllowedOrigin(request)) {
    throw new HttpError(403, "Origin is not allowed.");
  }
}

function isAllowedOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    return originUrl.host === request.headers.host && isLoopbackHostname(originUrl.hostname);
  } catch {
    return false;
  }
}

function isLoopbackHostname(hostname) {
  return ["127.0.0.1", "localhost", "[::1]"].includes(hostname.toLowerCase());
}

async function readJsonBody(request, { maxBytes }) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += Buffer.byteLength(chunk);
    if (size > maxBytes) {
      throw new HttpError(413, "Request body is too large.");
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) return {};
  return JSON.parse(text);
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendText(response, status, text) {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  response.end(text);
}

function contentType(filePath) {
  switch (extname(filePath)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "text/html; charset=utf-8";
  }
}

function safeWrite(text) {
  try {
    process.stdout.write(text);
  } catch {
    // Hidden/background launches may not provide a writable console.
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startWebServer();
}
