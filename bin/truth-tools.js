#!/usr/bin/env node
import { runCli } from "../src/cli.js";

runCli(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    process.stderr.write(`truth-tools: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
);
