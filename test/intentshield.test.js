import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateIntent } from "../src/intentshield.js";

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`../examples/${name}`, import.meta.url), "utf8"));
}

test("allows a small verified payment", async () => {
  const result = validateIntent(await fixture("safe-payment.json"));
  assert.equal(result.status, "allow");
  assert.equal(result.severity, "low");
  assert.deepEqual(result.reasonCodes, []);
});

test("requires review for value above approval threshold", async () => {
  const result = validateIntent(await fixture("review-grant.json"));
  assert.equal(result.status, "review");
  assert.equal(result.reasonCodes.includes("HUMAN_APPROVAL_REQUIRED"), true);
});

test("blocks unsafe intent with multiple risk reasons", async () => {
  const result = validateIntent(await fixture("unsafe-swap.json"));
  assert.equal(result.status, "block");
  assert.equal(result.severity, "critical");
  assert.equal(result.reasonCodes.includes("CHAIN_NOT_ALLOWED"), true);
  assert.equal(result.reasonCodes.includes("VALUE_EXCEEDS_MAX"), true);
  assert.equal(result.reasonCodes.includes("LOW_DATA_CONFIDENCE"), true);
});

test("suggests a lower-risk intent when blocked", async () => {
  const result = validateIntent(await fixture("unsafe-swap.json"));
  assert.ok(result.suggestedIntent);
  assert.equal(result.suggestedIntent.context.estimatedValueUsd, 100);
  assert.equal(result.suggestedIntent.context.slippageBps, 100);
  assert.equal(result.suggestedIntent.context.userConfirmation, true);
});
