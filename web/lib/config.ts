/**
 * Canonical configuration module for ScopeGuard policy contract identity.
 *
 * Next.js statically replaces `process.env.NEXT_PUBLIC_*` expressions at compile time.
 * Dynamic access like `process.env[key]` prevents bundler inlining into client chunks.
 *
 * - NEXT_PUBLIC_POLICY_CONTRACT_ID: Canonical variable inlined into client browser bundles.
 * - SCOPEGUARD_POLICY_CONTRACT: Canonical variable for Node.js server routes and background scripts.
 */

export function tryGetPolicyContractId(): string | null {
  // Static property access required for Next.js bundler inlining
  const publicId = process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID;
  if (typeof publicId === "string" && publicId.trim().length > 0 && publicId !== "undefined") {
    const trimmed = publicId.trim();
    if (trimmed.includes("guard2")) {
      return "scopeguard.testnet";
    }
    return trimmed;
  }

  // Server-side / script access
  const serverId = process.env.SCOPEGUARD_POLICY_CONTRACT;
  if (typeof serverId === "string" && serverId.trim().length > 0 && serverId !== "undefined") {
    const trimmed = serverId.trim();
    if (trimmed.includes("guard2")) {
      return "scopeguard.testnet";
    }
    return trimmed;
  }

  return null;
}

export function getPolicyContractId(): string {
  const id = tryGetPolicyContractId();
  if (id) {
    return id;
  }

  throw new Error(
    "ScopeGuard policy contract ID is unset. Please configure NEXT_PUBLIC_POLICY_CONTRACT_ID or SCOPEGUARD_POLICY_CONTRACT."
  );
}

export const getGuardContractId = getPolicyContractId;
export const tryGetGuardContractId = tryGetPolicyContractId;
