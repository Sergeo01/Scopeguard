import Ajv, { JSONSchemaType } from "ajv";

export interface DrafterPolicy {
  targets: Record<string, string[]>;
  daily_cap: string;
  recipients: string[];
  max_actions_per_10min: number;
  auto_pause_rejects: number;
  auto_pause_window_minutes: number;
  high_value_threshold: string;
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
    targets: {
      type: "object",
      required: [],
      additionalProperties: {
        type: "array",
        items: { type: "string" },
      },
    },
    daily_cap: { type: "string" },
    recipients: {
      type: "array",
      items: { type: "string" },
    },
    max_actions_per_10min: { type: "integer", minimum: 1, maximum: 100 },
    auto_pause_rejects: { type: "integer", minimum: 1, maximum: 50 },
    auto_pause_window_minutes: { type: "integer", minimum: 1, maximum: 1440 },
    high_value_threshold: { type: "string" },
    high_value_delay_seconds: { type: "integer", minimum: 0, maximum: 604800 },
    policy_change_delay_seconds: { type: "integer", minimum: 0, maximum: 604800 },
  },
  required: [
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

export function getSafeDefaultPolicy(dailyCap = "100"): DrafterPolicy {
  const capNum = Number(dailyCap) || 100;
  const threshold = String(Math.floor(capNum / 2));
  return {
    targets: {},
    daily_cap: String(capNum),
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
