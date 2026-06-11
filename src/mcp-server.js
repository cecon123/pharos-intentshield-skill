import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { createPolicyTemplate, validateIntent } from "./intentshield.js";

const server = new McpServer(
  {
    name: "pharos-intentshield-skill",
    version: "0.1.0"
  },
  {
    instructions:
      "Use IntentShield before executing on-chain agent actions. If the result is block, do not execute. If review, ask the user for approval or reduce risk."
  }
);

server.registerTool(
  "validate_intent",
  {
    title: "Validate On-chain Agent Intent",
    description:
      "Inspect a proposed on-chain agent intent and return allow/review/block, risk score, reason codes, and safer suggested intent.",
    inputSchema: z.object({
      intent: z.record(z.string(), z.any()).describe("Structured agent_intent JSON object.")
    }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true
    }
  },
  async ({ intent }) => {
    const result = validateIntent(intent);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result
    };
  }
);

server.registerTool(
  "policy_template",
  {
    title: "IntentShield Policy Template",
    description: "Return the default IntentShield policy template.",
    inputSchema: z.object({}),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true
    }
  },
  async () => {
    const output = createPolicyTemplate();
    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      structuredContent: output
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
