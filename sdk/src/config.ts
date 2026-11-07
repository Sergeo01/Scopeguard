/**
 * Canonical configuration module for ScopeGuard policy contract identity.
 * Replaces hardcoded fallbacks across the codebase.
 * Throws if the policy contract ID environment variable is unset (no silent fallbacks).
 */

export const POLICY_CONTRACT_ENV_VARS = [
  "SCOPEGUARD_POLICY_CONTRACT",
  "NEXT_PUBLIC_POLICY_CONTRACT_ID",
  "POLICY_CONTRACT_ID",
  "NEXT_PUBLIC_SCOPEGUARD_POLICY_CONTRACT",
  "NEXT_PUBLIC_GUARD_CONTRACT",
] as const;

export function getPolicyContractId(): string {
  if (typeof process !== "undefined" && process.env) {
    for (const key of POLICY_CONTRACT_ENV_VARS) {
      const val = process.env[key];
      if (val && val.trim().length > 0 && val !== "undefined") {
        return val.trim();
      }
    }
  }

  throw new Error(
    "ScopeGuard policy contract ID is unset. Please configure SCOPEGUARD_POLICY_CONTRACT or NEXT_PUBLIC_POLICY_CONTRACT_ID."
  );
}

export const getGuardContractId = getPolicyContractId;
