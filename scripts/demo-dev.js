import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const DEMO_DIR = new URL("../apps/demo/", import.meta.url);
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

export function startDemoServer({ port = 4173, host = "127.0.0.1" } = {}) {
  const server = createServer((request, response) => {
    const urlPath = decodeURIComponent((request.url ?? "/").split("?")[0]);
    const relative = normalize(urlPath).replace(/^\/+/, "");
    const filePath = join(new URL(".", DEMO_DIR).pathname, relative || "index.html");

    if (!filePath.startsWith(new URL(".", DEMO_DIR).pathname)) {
      response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    try {
      const stats = statSync(filePath);
      if (!stats.isFile()) throw new Error("not a file");
      const body = readFileSync(filePath);
      response.writeHead(200, {
        "content-type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
        "content-length": body.length
      });
      response.end(body);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      resolve({
        server,
        url: `http://${host}:${port}/`,
        close: () => new Promise((done) => server.close(done))
      });
    });
  });
}

export async function runDemoDev(argv = []) {
  const portArg = argv.find((arg) => arg.startsWith("--port="));
  const port = portArg ? Number(portArg.slice("--port=".length)) : 4173;
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("--port must be an integer between 0 and 65535.");
  }

  const { url, close } = await startDemoServer({ port });
  console.log(`Truth Tools demo: ${url}`);
  console.log("Static files only — no login, no telemetry, no network requests.");
  console.log("Press Ctrl+C to stop.");

  const shutdown = async () => {
    await close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  return 0;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  runDemoDev(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`truth-tools demo: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  );
}
