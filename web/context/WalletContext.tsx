"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { connect, keyStores, utils } from "near-api-js";

interface WalletContextType {
  accountId: string;
  isConnected: boolean;
  nearBalance: string;
  isLoadingBalance: boolean;
  connectWallet: (account: string) => Promise<void>;
  disconnectWallet: () => void;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const DEFAULT_OWNER = process.env.NEXT_PUBLIC_OWNER_ACCOUNT_ID || "sergeo-guard.testnet";
const RPC_URL = process.env.NEXT_PUBLIC_NEAR_RPC || "https://test.rpc.fastnear.com";

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accountId, setAccountId] = useState<string>(DEFAULT_OWNER);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [nearBalance, setNearBalance] = useState<string>("--");
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false);

  useEffect(() => {
    // Check saved wallet in localStorage on client mount
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("scopeguard_connected_account");
      if (saved) {
        setAccountId(saved);
        setIsConnected(true);
        fetchNearBalance(saved);
      } else {
        // Default to demo owner for immediate usability
        setAccountId(DEFAULT_OWNER);
        setIsConnected(true);
        fetchNearBalance(DEFAULT_OWNER);
      }
    }
  }, []);

  const fetchNearBalance = async (accId: string) => {
    if (!accId) return;
    setIsLoadingBalance(true);
    try {
      const near = await connect({
        networkId: "testnet",
        nodeUrl: RPC_URL,
        keyStore: new keyStores.InMemoryKeyStore(),
      });
      const account = await near.account(accId);
      const balance = await account.getAccountBalance();
      const formatted = utils.format.formatNearAmount(balance.available, 2);
      setNearBalance(formatted);
    } catch {
      setNearBalance("0.00");
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const connectWallet = async (accId: string) => {
    const cleanId = accId.trim();
    if (!cleanId) return;
    setAccountId(cleanId);
    setIsConnected(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("scopeguard_connected_account", cleanId);
    }
    await fetchNearBalance(cleanId);
  };

  const disconnectWallet = () => {
    setAccountId("");
    setIsConnected(false);
    setNearBalance("--");
    if (typeof window !== "undefined") {
      localStorage.removeItem("scopeguard_connected_account");
    }
  };

  const refreshBalance = async () => {
    if (accountId) {
      await fetchNearBalance(accountId);
    }
  };

  return (
    <WalletContext.Provider
      value={{
        accountId,
        isConnected,
        nearBalance,
        isLoadingBalance,
        connectWallet,
        disconnectWallet,
        refreshBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};
