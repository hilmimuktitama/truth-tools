import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { validateStatusArtifact } from "../src/contracts.js";

const DEMO_FILES = ["index.html", "styles.css", "app.js", "data.js"];
const SOURCE_DIR = new URL("../apps/demo/", import.meta.url);
const DIST_DIR = new URL("../apps/demo/dist/", import.meta.url);

export function buildDemo({ verbose = true } = {}) {
  mkdirSync(DIST_DIR, { recursive: true });

  const built = [];
  for (const file of DEMO_FILES) {
    const source = readFileSync(new URL(file, SOURCE_DIR));
    writeFileSync(new URL(file, DIST_DIR), source);
    built.push({ file, bytes: source.length });
  }

  const missing = DEMO_FILES.filter((file) => {
    try {
      return readFileSync(new URL(file, DIST_DIR)).length !== readFileSync(new URL(file, SOURCE_DIR)).length;
    } catch {
      return true;
    }
  });

  if (verbose) {
    for (const entry of built) console.log(`  built ${entry.file} (${entry.bytes} bytes)`);
  }
  return { ok: missing.length === 0, files: built };
}

export function verifyDist({ verbose = true } = {}) {
  const mismatches = [];
  for (const file of DEMO_FILES) {
    try {
      const source = readFileSync(new URL(file, SOURCE_DIR));
      const dist = readFileSync(new URL(file, DIST_DIR));
      if (!source.equals(dist)) mismatches.push(file);
    } catch {
      mismatches.push(file);
    }
  }
  if (verbose) {
    console.log(`Demo build: ${mismatches.length === 0 ? "dist matches sources" : `MISMATCH: ${mismatches.join(", ")}`}`);
  }
  return { ok: mismatches.length === 0, mismatches };
}

export function runDemoBuild(argv = []) {
  if (argv.includes("--verify")) {
    return verifyDist();
  }
  return buildDemo();
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const result = runDemoBuild(process.argv.slice(2));
  process.exitCode = result.ok ? 0 : 1;
}

export { validateStatusArtifact };
