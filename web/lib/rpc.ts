/**
 * Canonical NEAR RPC endpoint configuration and multi-provider failover.
 *
 * Uses FastNear as primary public testnet RPC (recommended by NEAR Foundation
 * following the deprecation of rpc.testnet.near.org on Nov 8, 2024).
 */

export function getVerifiedRpcEndpoints(): string[] {
  const customRpc = process.env.NEAR_TESTNET_RPC || process.env.NEXT_PUBLIC_NEAR_RPC;
  const endpoints = [
    customRpc,
    "https://test.rpc.fastnear.com",
    "https://rpc.testnet.fastnear.com",
    "https://rpc.testnet.near.org",
    "https://archival-rpc.testnet.near.org",
  ].filter((url): url is string => Boolean(url && typeof url === "string" && url.trim().length > 0));

  return Array.from(new Set(endpoints));
}

export const DEFAULT_NEAR_NETWORK = process.env.NEAR_NETWORK || "testnet";
