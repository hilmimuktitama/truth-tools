import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sdkAvailable = await import("@modelcontextprotocol/sdk/client/index.js")
  .then(() => true)
  .catch(() => false);

test("serves the focused contract over MCP stdio", { skip: !sdkAvailable }, async () => {
  const [{ Client }, { StdioClientTransport }] = await Promise.all([
    import("@modelcontextprotocol/sdk/client/index.js"),
    import("@modelcontextprotocol/sdk/client/stdio.js")
  ]);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../src/mcp-server.js", import.meta.url))]
  });
  const client = new Client({ name: "truth-tools-test", version: "1.0.0" }, { capabilities: {} });

  try {
    await client.connect(transport);
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name), ["truth.review", "truth.doctor"]);

    const doctor = await client.callTool({ name: "truth.doctor", arguments: {} });
    assert.equal(doctor.isError, undefined);
    assert.match(doctor.content[0].text, /"ok": true/);
  } finally {
    await client.close();
  }
});
