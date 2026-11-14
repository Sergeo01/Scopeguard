"use client";

import { KeyPair } from "near-api-js";

export interface StoredSubWalletKey {
  agentAccountId: string;
  privateKey: string;
  publicKey: string;
  createdAt: number;
  ownerAccount?: string;
  dailyCap?: number | string;
}

const STORAGE_KEY = "scopeguard_subwallet_keys";

// Built-in verified keys for testnet/demo agents
const DEFAULT_KNOWN_KEYS: Record<string, StoredSubWalletKey> = {
  "agent2.sergeo-guard.testnet": {
    agentAccountId: "agent2.sergeo-guard.testnet",
    privateKey:
      "ed25519:2cXnV7eGLFb5PnQUXyuaxSRVQAWwC7B7MEqYSkczBNxfGngKtx6kruo7wizP7usqMUgKBFkte9aWX5zjwPvmcFAv",
    publicKey: "ed25519:A7vUfC7JppnquiWa9gzETePkq16ucVBR4NSXnVtAP9CJ",
    createdAt: 1731456000000,
    ownerAccount: "sergeo-guard.testnet",
    dailyCap: 500,
  },
  "agent.sergeo-guard.testnet": {
    agentAccountId: "agent.sergeo-guard.testnet",
    privateKey:
      "ed25519:2cXnV7eGLFb5PnQUXyuaxSRVQAWwC7B7MEqYSkczBNxfGngKtx6kruo7wizP7usqMUgKBFkte9aWX5zjwPvmcFAv",
    publicKey: "ed25519:A7vUfC7JppnquiWa9gzETePkq16ucVBR4NSXnVtAP9CJ",
    createdAt: 1731456000000,
    ownerAccount: "sergeo-guard.testnet",
    dailyCap: 500,
  },
};

export function getAllSubWalletKeys(): Record<string, StoredSubWalletKey> {
  if (typeof window === "undefined") {
    return { ...DEFAULT_KNOWN_KEYS };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      ...DEFAULT_KNOWN_KEYS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_KNOWN_KEYS };
  }
}

export function getSubWalletKey(agentAccountId: string): StoredSubWalletKey | null {
  if (!agentAccountId) return null;
  const clean = agentAccountId.trim();
  const all = getAllSubWalletKeys();
  return all[clean] || null;
}

export function saveSubWalletKey(
  agentAccountId: string,
  data: {
    privateKey: string;
    publicKey?: string;
    ownerAccount?: string;
    dailyCap?: number | string;
  }
): StoredSubWalletKey {
  const clean = agentAccountId.trim();
  let pubKey = data.publicKey;

  if (!pubKey && data.privateKey) {
    try {
      const kp = KeyPair.fromString(data.privateKey as any);
      pubKey = kp.getPublicKey().toString();
    } catch {
      pubKey = "";
    }
  }

  const record: StoredSubWalletKey = {
    agentAccountId: clean,
    privateKey: data.privateKey,
    publicKey: pubKey || "",
    createdAt: Date.now(),
    ownerAccount: data.ownerAccount,
    dailyCap: data.dailyCap,
  };

  if (typeof window !== "undefined") {
    try {
      const all = getAllSubWalletKeys();
      all[clean] = record;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (err) {
      console.warn("Could not save sub-wallet key to localStorage:", err);
    }
  }

  return record;
}

export function generateAndSaveSubWalletKey(
  agentAccountId: string,
  ownerAccount?: string,
  dailyCap?: number | string
): StoredSubWalletKey {
  const keyPair = KeyPair.fromRandom("ed25519");
  const privKey = keyPair.toString();
  const pubKey = keyPair.getPublicKey().toString();

  return saveSubWalletKey(agentAccountId, {
    privateKey: privKey,
    publicKey: pubKey,
    ownerAccount,
    dailyCap,
  });
}
