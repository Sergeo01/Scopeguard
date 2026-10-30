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
  /** true only when the returned policy object passed structural validation */
  schemaValidated: boolean;
  validationErrors: string[];
}

const isInt = (v: unknown, min: number, max: number): boolean =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/**
 * Structural validation of a drafted policy against the onchain `Policy`
 * shape. This is not a lint pass (see `lintPolicy`); it answers a narrower
 * question: could this JSON be deserialized by the contract at all?
 */
export function validatePolicyShape(p: any): string[] {
  const errors: string[] = [];
  if (!p || typeof p !== "object") return ["policy is not an object"];

  if (typeof p.token !== "string" || !p.token.includes(".")) {
    errors.push("token must be a contract account id");
  }

  if (!p.targets || typeof p.targets !== "object" || Array.isArray(p.targets)) {
    errors.push("targets must be an object of contract -> method list");
  } else {
    const entries = Object.entries(p.targets as Record<string, unknown>);
    if (entries.length === 0) errors.push("targets must name at least one contract");
    for (const [contract, methods] of entries) {
      if (!contract.includes(".")) errors.push(`targets.${contract} is not an account id`);
      if (!Array.isArray(methods) || methods.length === 0) {
        errors.push(`targets.${contract} must list at least one method`);
      } else if (methods.some((m) => typeof m !== "string" || !m.length)) {
        errors.push(`targets.${contract} contains a non-string method`);
      }
    }
  }

  if (!isInt(p.daily_cap, 1, Number.MAX_SAFE_INTEGER)) {
    errors.push("daily_cap must be a positive integer");
  }
  if (!Array.isArray(p.recipients) || p.recipients.some((r: unknown) => typeof r !== "string")) {
    errors.push("recipients must be an array of account ids");
  }
  if (!isInt(p.max_actions_per_10min, 1, 100)) errors.push("max_actions_per_10min must be 1-100");
  if (!isInt(p.auto_pause_rejects, 1, 50)) errors.push("auto_pause_rejects must be 1-50");
  if (!isInt(p.auto_pause_window_minutes, 1, 1440)) {
    errors.push("auto_pause_window_minutes must be 1-1440");
  }
  if (!isInt(p.high_value_threshold, 0, Number.MAX_SAFE_INTEGER)) {
    errors.push("high_value_threshold must be a non-negative integer");
  }
  if (!isInt(p.high_value_delay_seconds, 0, Number.MAX_SAFE_INTEGER)) {
    errors.push("high_value_delay_seconds must be a non-negative integer");
  }
  if (!isInt(p.policy_change_delay_seconds, 0, Number.MAX_SAFE_INTEGER)) {
    errors.push("policy_change_delay_seconds must be a non-negative integer");
  }

  return errors;
}

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

  // Check 1: Open recipients with daily cap > 1000
  if (policy.recipients.length > 0 && BigInt(policy.daily_cap) > BigInt(1000)) {
    warnings.push({
      field: "recipients",
      message: "Policy allows direct fund transfers to external accounts with a large daily cap.",
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
      message: "High velocity limit allows rapid bursts that could deplete allowances quickly.",
      severity: "warning",
    });
  }

  // Check 4: High-value threshold exceeds daily cap
  if (BigInt(policy.high_value_threshold) > BigInt(policy.daily_cap)) {
    warnings.push({
      field: "high_value_threshold",
      message: "High-value threshold exceeds daily cap. The delayed timelock lane will never trigger because the daily cap check fires first.",
      severity: "warning",
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

  const capNote = hints?.isGuessDailyCap ? ` (conservative default, please verify)` : "";
  const velNote = hints?.isGuessVelocity ? ` (conservative default, please verify)` : "";
  const timelockNote = hints?.isGuessTimelock ? ` (proposed default, please verify)` : "";

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

export async function draftPolicyFromText(
  promptText: string,
  options?: { apiKey?: string }
): Promise<DraftResult> {
  const text = promptText.toLowerCase().trim();

  // If Gemini API Key is present, attempt LLM-based drafting
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
          const parsed = JSON.parse(rawContent);
          const errors = validatePolicyShape(parsed);
          if (errors.length === 0) {
            return {
              policy: parsed,
              plainEnglish: generatePlainEnglish(parsed),
              warnings: lintPolicy(parsed),
              isManualFallback: false,
              schemaValidated: true,
              validationErrors: [],
            };
          }
          // Model output did not match the schema: fall through to the
          // deterministic parser rather than shipping an unvalidated policy.
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
  const validationErrors = validatePolicyShape(draft);

  return {
    policy: draft,
    plainEnglish,
    warnings,
    isManualFallback: true,
    schemaValidated: validationErrors.length === 0,
    validationErrors,
  };
}
