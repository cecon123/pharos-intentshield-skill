#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { validateIntent, createPolicyTemplate } from "../src/intentshield.js";

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const [command, inputPath] = args.filter(arg => arg !== "--strict");

function printUsage() {
  console.log(`IntentShield CLI

Usage:
  intentshield validate <intent.json>
  intentshield validate <intent.json> --strict
  intentshield policy-template
`);
}

async function main() {
  if (!command || command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  if (command === "policy-template") {
    console.log(JSON.stringify(createPolicyTemplate(), null, 2));
    return;
  }

  if (command !== "validate" || !inputPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const raw = await readFile(inputPath, "utf8");
  const intent = JSON.parse(raw);
  const result = validateIntent(intent);
  console.log(JSON.stringify(result, null, 2));

  if (strict && result.status === "block") {
    process.exitCode = 2;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
