# IntentShield Skill

IntentShield is a reusable Skill for AI agents that need to inspect an on-chain intent before any wallet, contract, or Pharos agent execution step.

It is built for the Pharos Skill-to-Agent Dual Cascade Hackathon Phase 1. The core idea is simple: agents should not only know how to act on-chain; they should also know when not to act.

## What it does

- Validates a structured `agent_intent` JSON object.
- Checks chain, action type, recipient trust, value limits, slippage, gas, deadline, and confirmation policy.
- Returns a deterministic decision: `allow`, `review`, or `block`.
- Produces reason codes, risk score, audit hash, and safer suggested intent.
- Exposes both an agent Skill folder and an MCP stdio tool.

## Why it is different

Many agent demos focus on executing a swap, payment, or contract call. IntentShield is a composable safety primitive that other agents can reuse before they execute those actions. It is small enough to audit and broad enough to become part of future Pharos agent workflows.

## Quick start

```bash
npm install
npm test
npm run validate:safe
npm run validate:unsafe
```

Validate your own intent:

```bash
npx intentshield validate ./examples/safe-payment.json
```

Run as an MCP server:

```bash
npm run mcp
```

## Example output

```json
{
  "status": "block",
  "riskScore": 95,
  "severity": "critical",
  "reasonCodes": [
    "ACTION_NOT_ALLOWED",
    "VALUE_EXCEEDS_MAX",
    "SLIPPAGE_EXCEEDS_LIMIT"
  ]
}
```

## Project layout

- `skill/SKILL.md` - portable agent skill instructions.
- `src/intentshield.js` - core validator and scoring engine.
- `src/mcp-server.js` - MCP stdio tool wrapper.
- `schemas/agent-intent.schema.json` - structured intent contract.
- `examples/` - safe, review, and blocked sample intents.
- `test/` - node test suite.
- `docs/demo-transcript.md` - reproducible demo transcript.

## Intended Pharos use

An agent preparing a Pharos on-chain action can call IntentShield before execution:

1. Agent drafts an `agent_intent`.
2. IntentShield validates policy and produces a decision.
3. Agent proceeds only if status is `allow`.
4. If status is `review`, the agent asks the user for approval or reduces risk.
5. If status is `block`, the agent stops and reports the reason codes.

This makes the Skill composable for payment agents, DAO treasury agents, grant agents, token interaction agents, and future Pharos Agent Arena projects.

## Disclaimer

IntentShield is a developer safety and policy tool. It is not financial, legal, or security advice and does not guarantee transaction safety.
