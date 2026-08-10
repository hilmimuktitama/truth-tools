#!/usr/bin/env node
import { readFileSync } from "node:fs";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { callTruthToolForMcp, listTruthTools } from "./mcp-tools.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const server = new Server(
  { name: pkg.name, version: pkg.version },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: listTruthTools() }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    return callTruthToolForMcp(request.params.name, request.params.arguments ?? {});
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }]
    };
  }
});

await server.connect(new StdioServerTransport());
