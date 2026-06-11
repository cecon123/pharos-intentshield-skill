# DoraHacks Submission Draft

## Project title

IntentShield Skill

## Short description

A reusable pre-execution risk and policy Skill for AI agents before on-chain payments, swaps, grants, approvals, and other Pharos-style actions.

## Long description

IntentShield helps AI agents decide whether a proposed on-chain action should be allowed, reviewed, or blocked before execution. Agents submit a structured `agent_intent` JSON object. IntentShield checks chain allowlists, action permissions, recipient trust, value limits, gas/value ratio, slippage, deadline, data confidence, and user confirmation requirements.

The project includes a portable agent Skill, a Node CLI, an MCP stdio server, sample intents, JSON schema, and tests. This makes it useful as a reusable primitive for the Pharos Skill-to-Agent ecosystem: payment agents, grant agents, DAO treasury agents, trading assistants, and future Agent Arena projects can call the same validation layer before touching a wallet or contract.

Most hackathon agent demos focus on "how to execute." IntentShield focuses on "should this agent execute at all?" The output is structured and auditable: status, risk score, severity, reason codes, checks, safer suggested intent, and audit hash.

## Tags

AI Agent, Agent Skill, MCP, Pharos, Web3, Risk, Policy, On-chain Safety

## Repository

TBD after GitHub repo creation.

## Demo command

```bash
npm install
npm test
npm run validate:safe
npm run validate:unsafe
```
