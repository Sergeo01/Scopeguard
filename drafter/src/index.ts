import Ajv, { JSONSchemaType } from "ajv";

export interface DrafterPolicy {
  token: string;
  targets: Record<string, string[]>;
  daily_cap: number;
  recipients: string[];
  max_actions_per_10min: number;
  auto_pause_rejects: number;
  auto_pause_window_minutes: number;
  high_value_threshold: number;
  high_value_delay_seconds: number;
  policy_change_delay_seconds: number;
}

export interface LintWarning {
  field: string;
  message: string;
  severity: "warning" | "danger";
}

export interface DraftResult {
  policy: DrafterPolicy;
  plainEnglish: string;
  warnings: LintWarning[];
  isManualFallback: boolean;
}

const ajv = new Ajv();

const policySchema: JSONSchemaType<DrafterPolicy> = {
  type: "object",
  properties: {
    token: { type: "string" },
    targets: {
      type: "object",
      required: [],
      additionalProperties: {
        type: "array",
        items: { type: "string" },
      },
    },
    daily_cap: { type: "integer", minimum: 1 },
    recipients: {
      type: "array",
      items: { type: "string" },
    },
    max_actions_per_10min: { type: "integer", minimum: 1, maximum: 100 },
    auto_pause_rejects: { type: "integer", minimum: 1, maximum: 50 },
    auto_pause_window_minutes: { type: "integer", minimum: 1, maximum: 1440 },
    high_value_threshold: { type: "integer", minimum: 0 },
    high_value_delay_seconds: { type: "integer", minimum: 0, maximum: 604800 },
    policy_change_delay_seconds: { type: "integer", minimum: 0, maximum: 604800 },
  },
  required: [
    "token",
    "targets",
    "daily_cap",
    "recipients",
    "max_actions_per_10min",
    "auto_pause_rejects",
    "auto_pause_window_minutes",
    "high_value_threshold",
    "high_value_delay_seconds",
    "policy_change_delay_seconds",
  ],
  additionalProperties: false,
};

const validatePolicy = ajv.compile(policySchema);

export function getSafeDefaultPolicy(dailyCap: number | string = 100): DrafterPolicy {
  const capNum = Number(dailyCap) || 100;
  const threshold = Math.floor(capNum / 2);
  return {
    token: "sergeo-guard-token.testnet",
    targets: {
      "sergeo-guard-dex.testnet": ["swap"],
    },
    daily_cap: capNum,
    recipients: [],
    max_actions_per_10min: 5,
    auto_pause_rejects: 5,
    auto_pause_window_minutes: 10,
    high_value_threshold: threshold,
    high_value_delay_seconds: 3600,
    policy_change_delay_seconds: 600,
  };
}

export function lintPolicy(policy: DrafterPolicy): LintWarning[] {
  const warnings: LintWarning[] = [];

  // Check 1: Open recipients with daily cap > 0
  if (policy.recipients.length > 0 && BigInt(policy.daily_cap) > BigInt(1000)) {
    warnings.push({
      field: "recipients",
      message:
        "Policy allows direct fund transfers to external accounts with a large daily cap.",
      severity: "warning",
    });
  }

  // Check 2: Dangerous methods in targets
  const dangerousPatterns = ["upgrade", "delete_account", "set_owner", "kill"];
  for (const [target, methods] of Object.entries(policy.targets)) {
    for (const m of methods) {
      if (dangerousPatterns.some((pattern) => m.toLowerCase().includes(pattern))) {
        warnings.push({
          field: "targets",
          message: `Target ${target} includes potentially dangerous administrative method: ${m}`,
          severity: "danger",
        });
      }
    }
  }

  // Check 3: High velocity relative to daily cap
  if (policy.max_actions_per_10min > 30) {
    warnings.push({
      field: "max_actions_per_10min",
      message:
        "High velocity limit allows rapid bursts that could deplete allowances quickly.",
      severity: "warning",
    });
  }

  // Check 4: High-value threshold exceeds daily cap
  if (BigInt(policy.high_value_threshold) > BigInt(policy.daily_cap)) {
    warnings.push({
      field: "high_value_threshold",
      message:
        "High-value threshold exceeds daily cap. The delayed timelock lane will never trigger because the daily cap check fires first.",
      severity: "warning",
    });
  }

  // Check 5: High-value threshold set but delay is zero
  if (BigInt(policy.high_value_threshold) > BigInt(0) && policy.high_value_delay_seconds <= 0) {
    warnings.push({
      field: "high_value_delay_seconds",
      message:
        "High-value threshold is active, but delay is set to 0 seconds. A delay greater than 0 is required.",
      severity: "danger",
    });
  }

  return warnings;
}

export function generatePlainEnglish(
  policy: DrafterPolicy,
  hints?: {
    isGuessDailyCap?: boolean;
    isGuessVelocity?: boolean;
    isGuessTimelock?: boolean;
  }
): string {
  const targetDescriptions = Object.entries(policy.targets)
    .map(([target, methods]) => `${target} (methods: ${methods.join(", ")})`)
    .join("; ");

  const recipientDesc =
    policy.recipients.length > 0
      ? `Allowed payout recipients: ${policy.recipients.join(", ")}.`
      : "Direct transfers to outside recipients are completely forbidden.";

  const capNote = hints?.isGuessDailyCap
    ? ` (conservative default, please verify)`
    : "";
  const velNote = hints?.isGuessVelocity
    ? ` (conservative default, please verify)`
    : "";
  const timelockNote = hints?.isGuessTimelock
    ? ` (proposed default, please verify)`
    : "";

  const timelockDesc =
    BigInt(policy.high_value_threshold) > BigInt(0)
      ? `Actions at or above ${policy.high_value_threshold} mUSD enter a pending timelock lane for ${policy.high_value_delay_seconds} seconds before settlement${timelockNote}, allowing owner veto.`
      : "High-value timelock lane is disabled; all actions within budget execute immediately.";

  const policyDelayDesc = `Policy updates require a ${policy.policy_change_delay_seconds} second timelock delay before becoming effective.`;

  return [
    `This agent is authorized to interact strictly with: ${
      targetDescriptions || "no external contracts"
    }.`,
    `Maximum daily spending is capped at ${policy.daily_cap} mUSD${capNote}, resetting every 24 hours.`,
    `Velocity is limited to ${policy.max_actions_per_10min} actions per 10 minutes${velNote}.`,
    `The emergency circuit breaker trips if ${policy.auto_pause_rejects} rejected attempts occur within ${policy.auto_pause_window_minutes} minutes.`,
    timelockDesc,
    policyDelayDesc,
    recipientDesc,
  ].join(" ");
}

export function parseAndValidateDraft(rawJson: string): DraftResult {
  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    const fallback = getSafeDefaultPolicy();
    return {
      policy: fallback,
      plainEnglish: generatePlainEnglish(fallback),
      warnings: [
        {
          field: "rawJson",
          message: "Model response was not valid JSON. Fallen back to restrictive defaults.",
          severity: "danger",
        },
      ],
      isManualFallback: true,
    };
  }

  const valid = validatePolicy(parsed);
  if (!valid) {
    const fallback = getSafeDefaultPolicy();
    return {
      policy: fallback,
      plainEnglish: generatePlainEnglish(fallback),
      warnings: [
        {
          field: "schema",
          message: `Schema validation failed: ${ajv.errorsText(
            validatePolicy.errors
          )}. Fallen back to restrictive defaults.`,
          severity: "danger",
        },
      ],
      isManualFallback: true,
    };
  }

  const warnings = lintPolicy(parsed);
  return {
    policy: parsed,
    plainEnglish: generatePlainEnglish(parsed),
    warnings,
    isManualFallback: false,
  };
}

export async function draftPolicyFromText(
  promptText: string,
  options?: { apiKey?: string }
): Promise<DraftResult> {
  const text = promptText.toLowerCase().trim();

  // If Gemini API Key is present, attempt LLM-based drafting with schema validation
  if (options?.apiKey) {
    try {
      const systemPrompt = `You are an AI Security Policy Drafter for ScopeGuard on NEAR Protocol.
Draft a minimal-privilege JSON policy matching this schema:
{
  "token": "sergeo-guard-token.testnet",
  "targets": { "<contract_id>": ["<method>"] },
  "daily_cap": <integer>,
  "recipients": [],
  "max_actions_per_10min": <integer 1-100>,
  "auto_pause_rejects": <integer 1-50>,
  "auto_pause_window_minutes": <integer 1-1440>,
  "high_value_threshold": <integer>,
  "high_value_delay_seconds": <integer>,
  "policy_change_delay_seconds": <integer>
}
Rules:
1. Least privilege: recipients MUST be empty unless explicitly instructed.
2. Never propose wildcards (*). Name exact methods.
3. Return raw JSON only with zero markdown or fences.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${options.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${systemPrompt}\n\nUser request: "${promptText}"` }],
              },
            ],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawContent) {
          const result = parseAndValidateDraft(rawContent);
          if (!result.isManualFallback) {
            return result;
          }
        }
      }
    } catch {
      // Fall through to deterministic parser
    }
  }

  // Deterministic natural language parser following spec section 4
  let isGuessDailyCap = true;
  let isGuessVelocity = true;
  let isGuessTimelock = true;

  // Extract dollar amounts
  let dailyCap = "100";
  const capMatch = text.match(/(?:\$|cap of|limit of|up to|spend)\s*(\d+)/i) || text.match(/(\d+)\s*(?:musd|dollars|usd|\$)/i);
  if (capMatch) {
    dailyCap = capMatch[1];
    isGuessDailyCap = false;
  }

  // Extract speed / velocity
  let maxActions = 5;
  const speedMatch = text.match(/(\d+)\s*(?:actions|trades|txs|calls|swaps)/i);
  if (speedMatch) {
    maxActions = Math.min(100, Math.max(1, parseInt(speedMatch[1], 10)));
    isGuessVelocity = false;
  }

  // Extract circuit breaker rejects
  let autoPauseRejects = 3;
  const rejectMatch = text.match(/(\d+)\s*(?:rejects|strikes|failures|errors)/i);
  if (rejectMatch) {
    autoPauseRejects = Math.min(50, Math.max(1, parseInt(rejectMatch[1], 10)));
  }

  // Recognize target contracts
  const targets: Record<string, string[]> = {};
  if (text.includes("ref") || text.includes("ref finance")) {
    targets["ref-finance-101.testnet"] = ["swap"];
  }
  if (text.includes("burrow")) {
    targets["contract.burrow.testnet"] = ["deposit", "borrow"];
  }
  if (text.includes("dex") || text.includes("swap") || text.includes("mock") || Object.keys(targets).length === 0) {
    targets["sergeo-guard-dex.testnet"] = ["swap"];
  }

  // Extract external recipient if explicitly specified
  const recipients: string[] = [];
  const recipientMatch = text.match(/(?:to|send to|recipient|pay)\s+([a-z0-9_-]+\.(?:testnet|near))/i);
  if (recipientMatch) {
    recipients.push(recipientMatch[1]);
  }

  const capNum = Number(dailyCap) || 100;
  const threshold = Math.floor(capNum / 2);

  const draft: DrafterPolicy = {
    token: "sergeo-guard-token.testnet",
    targets,
    daily_cap: capNum,
    recipients,
    max_actions_per_10min: maxActions,
    auto_pause_rejects: autoPauseRejects,
    auto_pause_window_minutes: 10,
    high_value_threshold: threshold,
    high_value_delay_seconds: 60,
    policy_change_delay_seconds: 600,
  };

  const plainEnglish = generatePlainEnglish(draft, {
    isGuessDailyCap,
    isGuessVelocity,
    isGuessTimelock,
  });

  const warnings = lintPolicy(draft);

  return {
    policy: draft,
    plainEnglish,
    warnings,
    isManualFallback: false,
  };
}
