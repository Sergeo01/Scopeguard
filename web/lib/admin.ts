/**
 * Admin classification for ScopeGuard identities.
 *
 * This module holds only pure, dependency-free logic and is deliberately
 * separate from WalletContext so it can be unit tested under node. The admin
 * badge exists for UX only: no owner authority is granted by it, and the
 * onchain contract enforces ownership regardless of what the client believes.
 */

export interface ScopeGuardUser {
  id: string;
  email: string | null;
  displayName: string;
  provider: "google" | "near" | "github" | "email";
  avatar?: string;
  isAdmin: boolean;
  connectedWallets: string[];
  activeAccountId: string;
}

export const DEFAULT_ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "sergeo@scopeguard.io";
export const DEFAULT_OWNER_ACCOUNT = "sergeo-guard.testnet";

export const checkIsAdmin = (
  email?: string | null,
  accountId?: string | null,
  explicitAdmin?: boolean
): boolean => {
  if (explicitAdmin) return true;
  const cleanEmail = (email || "").toLowerCase().trim();
  const cleanAccount = (accountId || "").toLowerCase().trim();

  if (cleanEmail === DEFAULT_ADMIN_EMAIL.toLowerCase()) return true;
  const localPart = cleanEmail.split("@")[0] || "";
  if (
    localPart === "sergeo" ||
    localPart.startsWith("sergeo.") ||
    localPart.startsWith("sergeo-") ||
    localPart === "admin" ||
    localPart.startsWith("admin.")
  ) {
    return true;
  }

  if (cleanAccount === DEFAULT_OWNER_ACCOUNT.toLowerCase()) return true;
  if (cleanAccount.endsWith("sergeo-guard.testnet")) return true;
  return false;
};
