/**
 * Canonical NEAR RPC endpoint configuration and multi-provider failover.
 *
 * Provides verified RPC endpoints for NEAR Testnet with automatic failover
 * across FastNear, NEAR Foundation official testnet RPC, and archival RPC.
 */

export function getVerifiedRpcEndpoints(): string[] {
  const customRpc = process.env.NEAR_TESTNET_RPC || process.env.NEXT_PUBLIC_NEAR_RPC;
  const endpoints = [
    customRpc,
    "https://test.rpc.fastnear.com",
    "https://rpc.testnet.near.org",
    "https://archival-rpc.testnet.near.org",
  ].filter((url): url is string => Boolean(url && typeof url === "string" && url.trim().length > 0));

  return Array.from(new Set(endpoints));
}

export const DEFAULT_NEAR_NETWORK = process.env.NEAR_NETWORK || "testnet";
