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
  max_drawdown_bps?: number | null;
  lease_expires_at?: number | null;
  intent_recipients?: string[];
  canary_methods?: string[];
  near_daily_cap?: number | string | null;
  near_high_value_threshold?: number | string | null;
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
  if (!isInt(p.high_value_delay_seconds, 1, Number.MAX_SAFE_INTEGER)) {
    errors.push("high_value_delay_seconds must be a positive integer (> 0)");
  }
  if (!isInt(p.policy_change_delay_seconds, 1, Number.MAX_SAFE_INTEGER)) {
    errors.push("policy_change_delay_seconds must be a positive integer (> 0)");
  }
  if (p.max_drawdown_bps !== undefined && p.max_drawdown_bps !== null) {
    if (!isInt(p.max_drawdown_bps, 0, 10000)) {
      errors.push("max_drawdown_bps must be an integer between 0 and 10000");
    }
  }
  if (p.lease_expires_at !== undefined && p.lease_expires_at !== null) {
    const isNum = typeof p.lease_expires_at === "number" && Number.isFinite(p.lease_expires_at) && p.lease_expires_at > 0;
    const isStr = typeof p.lease_expires_at === "string" && /^\d+$/.test(p.lease_expires_at.trim()) && BigInt(p.lease_expires_at.trim()) > BigInt(0);
    const isBig = typeof p.lease_expires_at === "bigint" && p.lease_expires_at > BigInt(0);
    if (!isNum && !isStr && !isBig) {
      errors.push("lease_expires_at must be a positive integer timestamp");
    }
  }
  if (p.intent_recipients !== undefined && p.intent_recipients !== null) {
    if (!Array.isArray(p.intent_recipients) || p.intent_recipients.some((r: unknown) => typeof r !== "string")) {
      errors.push("intent_recipients must be an array of strings");
    }
  }
  if (p.canary_methods !== undefined && p.canary_methods !== null) {
    if (!Array.isArray(p.canary_methods) || p.canary_methods.some((m: unknown) => typeof m !== "string")) {
      errors.push("canary_methods must be an array of method name strings");
    }
  }
  if (p.near_daily_cap !== undefined && p.near_daily_cap !== null) {
    const isNum = typeof p.near_daily_cap === "number" && Number.isInteger(p.near_daily_cap) && p.near_daily_cap >= 0;
    const isStr = typeof p.near_daily_cap === "string" && /^\d+$/.test(p.near_daily_cap.trim());
    const isBig = typeof p.near_daily_cap === "bigint" && p.near_daily_cap >= BigInt(0);
    if (!isNum && !isStr && !isBig) {
      errors.push("near_daily_cap must be a non-negative integer");
    }
  }
  if (p.near_high_value_threshold !== undefined && p.near_high_value_threshold !== null) {
    const isNum = typeof p.near_high_value_threshold === "number" && Number.isInteger(p.near_high_value_threshold) && p.near_high_value_threshold >= 0;
    const isStr = typeof p.near_high_value_threshold === "string" && /^\d+$/.test(p.near_high_value_threshold.trim());
    const isBig = typeof p.near_high_value_threshold === "bigint" && p.near_high_value_threshold >= BigInt(0);
    if (!isNum && !isStr && !isBig) {
      errors.push("near_high_value_threshold must be a non-negative integer");
    }
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
    max_drawdown_bps: 1500,
    lease_expires_at: null,
    intent_recipients: [],
    canary_methods: ["emergency_withdraw_all", "drain_vault"],
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

  // Check 2: Dangerous and value-moving methods in targets
  const dangerousPatterns = ["upgrade", "delete_account", "set_owner", "kill"];
  const valueMovingDenylist = [
    "ft_transfer",
    "ft_transfer_call",
    "nft_transfer",
    "nft_transfer_call",
    "mt_transfer",
    "mt_transfer_call",
    "mt_batch_transfer",
    "mt_batch_transfer_call",
    "storage_unregister",
    "storage_withdraw",
    "near_withdraw",
    "withdraw",
  ];
  for (const [target, methods] of Object.entries(policy.targets)) {
    for (const m of methods) {
      if (dangerousPatterns.some((pattern) => m.toLowerCase().includes(pattern))) {
        warnings.push({
          field: "targets",
          message: `Target ${target} includes potentially dangerous administrative method: ${m}`,
          severity: "danger",
        });
      }
      if (valueMovingDenylist.includes(m)) {
        // Exception: policy token with ft_transfer is valid and required when policy has allowlisted recipients
        if (target === policy.token && m === "ft_transfer" && Array.isArray(policy.recipients) && policy.recipients.length > 0) {
          continue;
        }
        warnings.push({
          field: "targets",
          message: `Target ${target} includes forbidden value-moving method: ${m}. Calldata transfers must use typed Guard actions.`,
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
      ? `Allowed payout recipients: ${policy.recipients.join(", ")} (via ${policy.token} ft_transfer).`
      : "Direct transfers to outside recipients are completely forbidden.";

  const capNote = hints?.isGuessDailyCap ? ` (conservative default, please verify)` : "";
  const velNote = hints?.isGuessVelocity ? ` (conservative default, please verify)` : "";
  const timelockNote = hints?.isGuessTimelock ? ` (proposed default, please verify)` : "";

  const timelockDesc =
    BigInt(policy.high_value_threshold) > BigInt(0)
      ? `Actions at or above ${policy.high_value_threshold} mUSD enter a pending timelock lane for ${policy.high_value_delay_seconds} seconds before settlement${timelockNote}, allowing owner veto.`
      : "High-value timelock lane is disabled; all actions within budget execute immediately.";

  const policyDelayDesc = `Policy updates require a ${policy.policy_change_delay_seconds} second timelock delay before becoming effective.`;

  const drawdownDesc = policy.max_drawdown_bps
    ? `Net drawdown breaker limits cumulative loss to ${(policy.max_drawdown_bps / 100).toFixed(1)}% from high-water mark.`
    : "";
  const leaseDesc = policy.lease_expires_at
    ? `Task lease expires at block timestamp ${policy.lease_expires_at}.`
    : "";
  const intentDesc = policy.intent_recipients && policy.intent_recipients.length > 0
    ? `IntentShield protects cross-chain transfers (targets intents.near) to: ${policy.intent_recipients.join(", ")}.`
    : "";
  const canaryDesc = policy.canary_methods && policy.canary_methods.length > 0
    ? `Canary tripwires active on: ${policy.canary_methods.join(", ")}.`
    : "";

  return [
    `This agent is authorized to interact strictly with: ${
      targetDescriptions || "no external contracts"
    }.`,
    `Maximum daily spending is capped at ${policy.daily_cap} mUSD${capNote}, resetting every 24 hours.`,
    `Velocity is limited to ${policy.max_actions_per_10min} actions per 10 minutes${velNote}.`,
    `The emergency circuit breaker trips if ${policy.auto_pause_rejects} rejected attempts occur within ${policy.auto_pause_window_minutes} minutes.`,
    drawdownDesc,
    leaseDesc,
    intentDesc,
    canaryDesc,
    timelockDesc,
    policyDelayDesc,
    recipientDesc,
  ]
    .filter(Boolean)
    .join(" ");
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
  "policy_change_delay_seconds": <integer>,
  "max_drawdown_bps": <optional integer 0-10000, default 1500>,
  "lease_expires_at": <optional null or unix timestamp in nanoseconds>,
  "intent_recipients": <optional array of cross-chain recipient addresses, default []>,
  "canary_methods": <array of decoy method names, default ["emergency_withdraw_all", "drain_vault"]>
}
Rules:
1. Least privilege: recipients MUST be empty unless explicitly instructed.
2. When the owner describes paying, sending, or transferring funds to named accounts, include the token contract ("sergeo-guard-token.testnet") with method "ft_transfer" in targets AND those exact accounts in recipients, because the contract requires both.
3. Never propose wildcards (*). Name exact methods.
4. Include canary_methods with decoy names to detect rogue prompt injections.
5. Return raw JSON only with zero markdown or fences.`;

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

          // Exactly one repair retry with validator errors fed back to the model
          try {
            const repairRes = await fetch(
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
                    {
                      role: "model",
                      parts: [{ text: rawContent }],
                    },
                    {
                      role: "user",
                      parts: [
                        {
                          text: `Your JSON failed strict validation with these errors: ${errors.join(
                            ", "
                          )}. Repair the policy to strictly adhere to the schema and return raw JSON.`,
                        },
                      ],
                    },
                  ],
                  generationConfig: { responseMimeType: "application/json" },
                }),
              }
            );
            if (repairRes.ok) {
              const repairData = await repairRes.json();
              const repairContent = repairData.candidates?.[0]?.content?.parts?.[0]?.text;
              if (repairContent) {
                const repaired = JSON.parse(repairContent);
                const repairedErrors = validatePolicyShape(repaired);
                if (repairedErrors.length === 0) {
                  return {
                    policy: repaired,
                    plainEnglish: generatePlainEnglish(repaired),
                    warnings: lintPolicy(repaired),
                    isManualFallback: false,
                    schemaValidated: true,
                    validationErrors: [],
                  };
                }
              }
            }
          } catch {
            // Repair failed, fall through to deterministic fallback
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

  // Extract the daily spend cap.
  //
  // Phrasings people actually type include "cap 200 per day", "budget of 300",
  // "$250/day", "300 mUSD" and "up to 400". The old pattern required "cap of"
  // or a trailing currency word, so "cap 200 per day" silently fell back to the
  // 100 default while still claiming to have understood the request.
  //
  // The negative lookahead keeps velocity wording ("max 4 actions", "5 swaps
  // per 10 min") from being mistaken for the cap.
  let dailyCap = "100";
  const notVelocity = String.raw`(?!\s*(?:actions|trades|swaps|txs|calls|transactions|per\s*10))`;
  const capMatch =
    text.match(
      new RegExp(String.raw`(?:daily\s+cap|daily\s+limit|cap|budget|limit|spend|allowance|up\s+to)\s*(?:of|is|at|to|:)?\s*\$?\s*(\d+)` + notVelocity, "i")
    ) ||
    text.match(/\$\s*(\d+)/) ||
    text.match(new RegExp(String.raw`(\d+)\s*(?:musd|dollars|usd)` + notVelocity, "i")) ||
    text.match(/(\d+)\s*(?:per|\/)\s*(?:day|24h)/i);
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
  if (/\b(?:ref|ref\s+finance)\b/i.test(text)) {
    targets["ref-finance-101.testnet"] = ["swap"];
  }
  if (/\bburrow\b/i.test(text)) {
    targets["contract.burrow.testnet"] = ["deposit", "borrow"];
  }
  if (/\b(?:dex|swap|mock)\b/i.test(text) || Object.keys(targets).length === 0) {
    targets["sergeo-guard-dex.testnet"] = ["swap"];
  }

  // Extract external recipient if explicitly specified
  const recipients: string[] = [];
  const recipientMatch = text.match(/(?:to|send to|recipient|pay|transfer to)\s+([a-z0-9_-]+\.(?:testnet|near))/i);
  if (recipientMatch) {
    recipients.push(recipientMatch[1]);
  }

  const tokenContract = "sergeo-guard-token.testnet";
  if (recipients.length > 0) {
    targets[tokenContract] = ["ft_transfer"];
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
    policy_change_delay_seconds: 60,
    max_drawdown_bps: 1500,
    lease_expires_at: null,
    intent_recipients: [],
    canary_methods: ["emergency_withdraw_all", "drain_vault"],
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
