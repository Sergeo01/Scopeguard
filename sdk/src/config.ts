/**
 * Canonical configuration module for ScopeGuard policy contract identity.
 *
 * - SCOPEGUARD_POLICY_CONTRACT: Canonical variable for Node.js server and CLI scripts.
 * - NEXT_PUBLIC_POLICY_CONTRACT_ID: Canonical public variable when running in isomorphic/browser environments.
 */

export function tryGetPolicyContractId(): string | null {
  const serverId = process.env.SCOPEGUARD_POLICY_CONTRACT;
  if (typeof serverId === "string" && serverId.trim().length > 0 && serverId !== "undefined") {
    return serverId.trim();
  }

  const publicId = process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID;
  if (typeof publicId === "string" && publicId.trim().length > 0 && publicId !== "undefined") {
    return publicId.trim();
  }

  return null;
}

export function getPolicyContractId(): string {
  const id = tryGetPolicyContractId();
  if (id) {
    return id;
  }

  throw new Error(
    "ScopeGuard policy contract ID is unset. Please configure SCOPEGUARD_POLICY_CONTRACT or NEXT_PUBLIC_POLICY_CONTRACT_ID."
  );
}

export const getGuardContractId = getPolicyContractId;
export const tryGetGuardContractId = tryGetPolicyContractId;
