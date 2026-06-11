---
name: intentshield
description: Use before an AI agent executes or prepares any on-chain payment, swap, approval, grant, deploy, bridge, or message action. Validates structured intent against policy and returns allow/review/block.
---

# IntentShield Skill

IntentShield is a pre-execution risk and policy skill for AI agents. Use it when a user or agent proposes an on-chain action and you need a clear safety decision before execution.

## When to use

Use this skill before:

- token payments
- swaps
- approvals
- contract deployment
- grant payouts
- bridge actions
- signed on-chain messages

Do not use it as a replacement for wallet confirmation, formal audit, legal advice, or financial advice.

## Required input

Call the CLI or MCP tool with an `agent_intent` JSON object:

```json
{
  "intentId": "intent-001",
  "agentId": "agent-name",
  "chainId": 50002,
  "action": "pay",
  "asset": { "symbol": "USDC", "amount": 12.5, "decimals": 6 },
  "recipient": {
    "address": "0x1111111111111111111111111111111111111111",
    "label": "verified merchant",
    "trustTier": "verified"
  },
  "limits": {
    "maxAmountUsd": 100,
    "allowedChains": [50002],
    "allowedActions": ["pay", "message"]
  },
  "context": {
    "estimatedValueUsd": 12.5,
    "estimatedGasUsd": 0.02,
    "slippageBps": 0,
    "deadlineMinutes": 30,
    "purpose": "Pay verified merchant invoice INV-1001",
    "dataSourceConfidence": 0.95,
    "userConfirmation": true
  }
}
```

## CLI

```bash
npm install
npx intentshield validate examples/safe-payment.json
```

## MCP

Start the server:

```bash
npm run mcp
```

Available MCP tools:

- `validate_intent`
- `policy_template`

## Decision rules

- `allow`: agent may continue to normal wallet/user confirmation.
- `review`: agent must ask the user for approval, reduce risk, or clarify missing context.
- `block`: agent must not execute. Report reason codes and safer suggested intent.

## Output contract

The tool returns:

- `status`
- `riskScore`
- `severity`
- `reasonCodes`
- `summary`
- `checks`
- `suggestedIntent`
- `auditHash`

## Agent behavior

If status is `block`, stop execution. Do not retry with hidden parameter changes.

If status is `review`, explain the risk flags and ask the user before changing the intent.

If status is `allow`, continue only through the normal wallet/signing flow.
