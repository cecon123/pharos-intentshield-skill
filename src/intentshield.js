import { createHash } from "node:crypto";

const ACTIONS = new Set(["pay", "swap", "approve", "deploy", "grant", "bridge", "message"]);
const TRUST_TIERS = new Set(["verified", "known", "unknown", "blocked"]);

export function createPolicyTemplate() {
  return {
    maxAmountUsd: 100,
    dailyBudgetUsd: 250,
    maxSlippageBps: 100,
    allowedChains: [50002, 56, 1],
    allowedActions: ["pay", "swap", "grant", "message"],
    allowContractDeploy: false,
    blockUnknownRecipients: true,
    requireHumanApprovalAboveUsd: 50,
    maxGasToValueRatio: 0.08
  };
}

export function validateIntent(intent) {
  const checks = [];
  const reasons = new Set();
  const normalized = normalizeIntent(intent);
  const schemaErrors = validateShape(normalized);

  for (const error of schemaErrors) {
    addCheck(checks, "schema", "block", error.code, error.message, error.weight);
    reasons.add(error.code);
  }

  const policy = {
    ...createPolicyTemplate(),
    ...(normalized.limits ?? {})
  };

  runPolicyChecks(normalized, policy, checks, reasons);

  const riskScore = clamp(
    checks.reduce((sum, check) => sum + check.weight, 0),
    0,
    100
  );
  const hasBlock = checks.some(check => check.level === "block");
  const hasReview = checks.some(check => check.level === "review");
  const status = hasBlock ? "block" : hasReview || riskScore >= 30 ? "review" : "allow";

  return {
    status,
    riskScore,
    severity: severityFor(riskScore, status),
    reasonCodes: [...reasons],
    summary: summarize(status, riskScore, reasons),
    checks,
    suggestedIntent: suggestIntent(normalized, policy, status),
    auditHash: auditHash(normalized, checks)
  };
}

function normalizeIntent(intent) {
  return {
    intentId: intent?.intentId ?? "unknown-intent",
    agentId: intent?.agentId ?? "unknown-agent",
    chainId: Number(intent?.chainId),
    action: intent?.action,
    asset: {
      symbol: intent?.asset?.symbol,
      address: intent?.asset?.address,
      amount: Number(intent?.asset?.amount ?? 0),
      decimals: Number(intent?.asset?.decimals ?? 18)
    },
    recipient: {
      address: intent?.recipient?.address,
      label: intent?.recipient?.label ?? "unlabeled",
      trustTier: intent?.recipient?.trustTier ?? "unknown"
    },
    limits: intent?.limits ?? {},
    context: {
      estimatedValueUsd: Number(intent?.context?.estimatedValueUsd ?? 0),
      estimatedGasUsd: Number(intent?.context?.estimatedGasUsd ?? 0),
      slippageBps: Number(intent?.context?.slippageBps ?? 0),
      deadlineMinutes: Number(intent?.context?.deadlineMinutes ?? 30),
      purpose: intent?.context?.purpose ?? "",
      dataSourceConfidence: Number(intent?.context?.dataSourceConfidence ?? 1),
      userConfirmation: Boolean(intent?.context?.userConfirmation)
    },
    metadata: intent?.metadata ?? {}
  };
}

function validateShape(intent) {
  const errors = [];
  if (!intent.intentId || intent.intentId === "unknown-intent") {
    errors.push(err("MISSING_INTENT_ID", "Intent must include intentId.", 20));
  }
  if (!intent.agentId || intent.agentId === "unknown-agent") {
    errors.push(err("MISSING_AGENT_ID", "Intent must include agentId.", 10));
  }
  if (!Number.isInteger(intent.chainId)) {
    errors.push(err("INVALID_CHAIN_ID", "chainId must be an integer.", 35));
  }
  if (!ACTIONS.has(intent.action)) {
    errors.push(err("INVALID_ACTION", `action must be one of: ${[...ACTIONS].join(", ")}.`, 40));
  }
  if (!intent.asset.symbol || intent.asset.amount <= 0) {
    errors.push(err("INVALID_ASSET", "asset.symbol and positive asset.amount are required.", 30));
  }
  if (!intent.recipient.address || !/^0x[a-fA-F0-9]{40}$/.test(intent.recipient.address)) {
    errors.push(err("INVALID_RECIPIENT", "recipient.address must be an EVM address.", 40));
  }
  if (!TRUST_TIERS.has(intent.recipient.trustTier)) {
    errors.push(err("INVALID_TRUST_TIER", `recipient.trustTier must be one of: ${[...TRUST_TIERS].join(", ")}.`, 25));
  }
  return errors;
}

function runPolicyChecks(intent, policy, checks, reasons) {
  if (!policy.allowedChains.includes(intent.chainId)) {
    addReason(checks, reasons, "chain", "block", "CHAIN_NOT_ALLOWED", `Chain ${intent.chainId} is outside allowedChains.`, 70);
  }

  if (!policy.allowedActions.includes(intent.action)) {
    addReason(checks, reasons, "action", "block", "ACTION_NOT_ALLOWED", `Action ${intent.action} is outside allowedActions.`, 70);
  }

  if (intent.action === "deploy" && !policy.allowContractDeploy) {
    addReason(checks, reasons, "action", "block", "DEPLOY_NOT_ALLOWED", "Contract deployment is disabled by policy.", 80);
  }

  if (intent.recipient.trustTier === "blocked") {
    addReason(checks, reasons, "recipient", "block", "RECIPIENT_BLOCKED", "Recipient is explicitly blocked.", 100);
  }

  if (intent.recipient.trustTier === "unknown" && policy.blockUnknownRecipients) {
    addReason(checks, reasons, "recipient", "block", "UNKNOWN_RECIPIENT_BLOCKED", "Unknown recipients require a trusted label or allowlist.", 55);
  } else if (intent.recipient.trustTier === "unknown") {
    addReason(checks, reasons, "recipient", "review", "UNKNOWN_RECIPIENT", "Recipient is unknown and should be reviewed.", 30);
  }

  if (intent.context.estimatedValueUsd > policy.maxAmountUsd) {
    addReason(
      checks,
      reasons,
      "value",
      "block",
      "VALUE_EXCEEDS_MAX",
      `Estimated value ${intent.context.estimatedValueUsd} USD exceeds maxAmountUsd ${policy.maxAmountUsd}.`,
      65
    );
  }

  if (intent.context.estimatedValueUsd > policy.dailyBudgetUsd) {
    addReason(
      checks,
      reasons,
      "budget",
      "block",
      "DAILY_BUDGET_EXCEEDED",
      `Estimated value ${intent.context.estimatedValueUsd} USD exceeds dailyBudgetUsd ${policy.dailyBudgetUsd}.`,
      70
    );
  }

  if (
    intent.context.estimatedValueUsd > policy.requireHumanApprovalAboveUsd &&
    !intent.context.userConfirmation
  ) {
    addReason(
      checks,
      reasons,
      "approval",
      "review",
      "HUMAN_APPROVAL_REQUIRED",
      "Intent value is above human approval threshold.",
      35
    );
  }

  if (intent.context.slippageBps > policy.maxSlippageBps * 2) {
    addReason(checks, reasons, "slippage", "block", "SLIPPAGE_CRITICAL", "Slippage is more than 2x the configured limit.", 65);
  } else if (intent.context.slippageBps > policy.maxSlippageBps) {
    addReason(checks, reasons, "slippage", "review", "SLIPPAGE_EXCEEDS_LIMIT", "Slippage exceeds configured limit.", 35);
  }

  if (intent.context.estimatedValueUsd > 0) {
    const gasRatio = intent.context.estimatedGasUsd / intent.context.estimatedValueUsd;
    if (gasRatio > policy.maxGasToValueRatio) {
      addReason(checks, reasons, "gas", "review", "GAS_VALUE_RATIO_HIGH", "Gas cost is high relative to value.", 25);
    }
  }

  if (intent.context.deadlineMinutes < 2 || intent.context.deadlineMinutes > 1440) {
    addReason(checks, reasons, "deadline", "review", "UNUSUAL_DEADLINE", "Deadline is unusually short or long.", 15);
  }

  if (intent.context.dataSourceConfidence < 0.4) {
    addReason(checks, reasons, "data", "block", "LOW_DATA_CONFIDENCE", "Data confidence is below 0.4.", 55);
  } else if (intent.context.dataSourceConfidence < 0.65) {
    addReason(checks, reasons, "data", "review", "DATA_CONFIDENCE_WEAK", "Data confidence is below review threshold.", 25);
  }

  if (!intent.context.purpose || intent.context.purpose.trim().length < 12) {
    addReason(checks, reasons, "purpose", "review", "PURPOSE_UNCLEAR", "Purpose should be specific enough for audit review.", 20);
  }
}

function suggestIntent(intent, policy, status) {
  if (status === "allow") {
    return null;
  }

  const suggestion = structuredClone(intent);
  suggestion.context = { ...intent.context };
  suggestion.limits = { ...policy };

  if (suggestion.context.estimatedValueUsd > policy.maxAmountUsd) {
    const scale = policy.maxAmountUsd / suggestion.context.estimatedValueUsd;
    suggestion.asset.amount = Number((suggestion.asset.amount * scale).toFixed(8));
    suggestion.context.estimatedValueUsd = policy.maxAmountUsd;
  }

  if (suggestion.context.slippageBps > policy.maxSlippageBps) {
    suggestion.context.slippageBps = policy.maxSlippageBps;
  }

  if (!policy.allowedChains.includes(suggestion.chainId) && policy.allowedChains.length > 0) {
    suggestion.chainId = policy.allowedChains[0];
  }

  if (!policy.allowedActions.includes(suggestion.action) && policy.allowedActions.length > 0) {
    suggestion.action = policy.allowedActions[0];
  }

  if (suggestion.recipient.trustTier === "unknown") {
    suggestion.recipient.label = "Needs allowlist review";
  }

  suggestion.context.userConfirmation = true;
  suggestion.metadata = {
    ...suggestion.metadata,
    intentshieldSuggestion: "Lower value/slippage or obtain human approval before execution."
  };
  return suggestion;
}

function summarize(status, riskScore, reasons) {
  const codes = [...reasons].join(", ") || "NO_RISK_FLAGS";
  return `IntentShield decision: ${status} at risk ${riskScore}/100. Reason codes: ${codes}.`;
}

function severityFor(riskScore, status) {
  if (status === "block" || riskScore >= 75) return "critical";
  if (riskScore >= 50) return "high";
  if (riskScore >= 25) return "medium";
  return "low";
}

function auditHash(intent, checks) {
  return createHash("sha256")
    .update(stableStringify({ intent, checks }))
    .digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function err(code, message, weight) {
  return { code, message, weight };
}

function addReason(checks, reasons, area, level, code, message, weight) {
  addCheck(checks, area, level, code, message, weight);
  reasons.add(code);
}

function addCheck(checks, area, level, code, message, weight) {
  checks.push({ area, level, code, message, weight });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
