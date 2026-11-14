/**
 * Canonical NEAR RPC endpoint configuration and multi-provider failover.
 *
 * Uses FastNear as primary public testnet RPC (recommended by NEAR Foundation
 * following the deprecation of rpc.testnet.near.org on Nov 8, 2024).
 */

const rpcCooldowns = new Map<string, number>();

export function markRpcFailed(url: string, cooldownMs = 60000): void {
  rpcCooldowns.set(url, Date.now() + cooldownMs);
}

export function getVerifiedRpcEndpoints(): string[] {
  const customRpc = process.env.NEAR_TESTNET_RPC || process.env.NEXT_PUBLIC_NEAR_RPC;
  const endpoints = [
    customRpc,
    "https://rpc.testnet.near.org",
    "https://test.rpc.fastnear.com",
    "https://rpc.testnet.fastnear.com",
    "https://archival-rpc.testnet.near.org",
  ].filter((url): url is string => Boolean(url && typeof url === "string" && url.trim().length > 0));

  const unique = Array.from(new Set(endpoints));
  const now = Date.now();

  return unique.sort((a, b) => {
    const aCool = (rpcCooldowns.get(a) || 0) > now ? 1 : 0;
    const bCool = (rpcCooldowns.get(b) || 0) > now ? 1 : 0;
    return aCool - bCool;
  });
}

export const DEFAULT_NEAR_NETWORK = process.env.NEAR_NETWORK || "testnet";
