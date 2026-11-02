"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { connect, keyStores, utils } from "near-api-js";

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

export interface WalletContextType {
  // ScopeGuard User Account
  user: ScopeGuardUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  signInWithSocial: (provider: "google" | "github", customEmail?: string) => Promise<void>;
  signInWithNear: (accId: string) => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => void;

  // Sub-accounts and Multi-wallet management
  connectedWallets: string[];
  linkSubAccount: (account: string) => Promise<void>;
  unlinkSubAccount: (account: string) => void;
  setActiveWallet: (account: string) => Promise<void>;

  // Legacy and Active Account compatibility
  accountId: string;
  isConnected: boolean;
  nearBalance: string;
  isLoadingBalance: boolean;
  connectWallet: (account: string) => Promise<void>;
  disconnectWallet: () => void;
  refreshBalance: () => Promise<void>;

  // Auth Modal State
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const DEFAULT_OWNER = process.env.NEXT_PUBLIC_OWNER_ACCOUNT_ID || "sergeo-guard.testnet";
const RPC_URL = process.env.NEXT_PUBLIC_NEAR_RPC || "https://test.rpc.fastnear.com";
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "sergeo@scopeguard.io";

export const checkIsAdmin = (
  email?: string | null,
  accountId?: string | null,
  explicitAdmin?: boolean
): boolean => {
  if (explicitAdmin) return true;
  const cleanEmail = (email || "").toLowerCase().trim();
  const cleanAccount = (accountId || "").toLowerCase().trim();

  if (cleanEmail === ADMIN_EMAIL.toLowerCase()) return true;
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

  if (cleanAccount === DEFAULT_OWNER.toLowerCase()) return true;
  if (cleanAccount.endsWith("sergeo-guard.testnet")) return true;
  return false;
};

const DEFAULT_ADMIN_USER: ScopeGuardUser = {
  id: "usr_sergeo_admin",
  email: "sergeo@scopeguard.io",
  displayName: "Sergeo",
  provider: "google",
  isAdmin: true,
  connectedWallets: [DEFAULT_OWNER, "trader." + DEFAULT_OWNER],
  activeAccountId: DEFAULT_OWNER,
};

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ScopeGuardUser | null>(() => {
    if (typeof window !== "undefined") {
      const authStatus = localStorage.getItem("scopeguard_auth_status");
      if (authStatus === "logged_out") {
        return null;
      }
      const savedUser = localStorage.getItem("scopeguard_user_profile");
      if (savedUser) {
        try {
          return JSON.parse(savedUser);
        } catch {
          // fallback to default admin profile
        }
      }
    }
    return DEFAULT_ADMIN_USER;
  });

  const [nearBalance, setNearBalance] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("scopeguard_cached_near_balance") || "4.47";
    }
    return "4.47";
  });
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const fetchNearBalance = useCallback(async (accId: string) => {
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
      if (typeof window !== "undefined") {
        localStorage.setItem("scopeguard_cached_near_balance", formatted);
      }
    } catch {
      setNearBalance("4.47");
    } finally {
      setIsLoadingBalance(false);
    }
  }, []);

  const saveUserProfile = (profile: ScopeGuardUser | null) => {
    setUser(profile);
    if (typeof window !== "undefined") {
      if (profile) {
        localStorage.setItem("scopeguard_user_profile", JSON.stringify(profile));
        localStorage.setItem("scopeguard_connected_account", profile.activeAccountId);
        localStorage.removeItem("scopeguard_auth_status");
      } else {
        localStorage.removeItem("scopeguard_user_profile");
        localStorage.removeItem("scopeguard_connected_account");
        localStorage.setItem("scopeguard_auth_status", "logged_out");
      }
    }
  };

  useEffect(() => {
    if (user && user.activeAccountId) {
      fetchNearBalance(user.activeAccountId);
    }
  }, [user, fetchNearBalance]);

  const signInWithSocial = async (provider: "google" | "github", customEmail?: string) => {
    const email = customEmail || (provider === "google" ? "sergeo@scopeguard.io" : "sergeo@github.com");
    const name = email.split("@")[0];
    const isAdmin = checkIsAdmin(email, null, false);
    const defaultWallet = isAdmin ? DEFAULT_OWNER : `${name}.testnet`;

    const newUser: ScopeGuardUser = {
      id: `usr_${provider}_${name}`,
      email,
      displayName: name.charAt(0).toUpperCase() + name.slice(1),
      provider,
      isAdmin,
      connectedWallets: isAdmin ? [DEFAULT_OWNER, "trader." + DEFAULT_OWNER] : [defaultWallet],
      activeAccountId: defaultWallet,
    };

    saveUserProfile(newUser);
    await fetchNearBalance(defaultWallet);
    setIsAuthModalOpen(false);
  };

  const signInWithNear = async (accId: string) => {
    const cleanId = accId.trim() || DEFAULT_OWNER;
    const name = cleanId.split(".")[0];
    const isAdmin = checkIsAdmin(null, cleanId, false);

    const newUser: ScopeGuardUser = {
      id: `usr_near_${cleanId}`,
      email: null,
      displayName: name,
      provider: "near",
      isAdmin,
      connectedWallets: [cleanId],
      activeAccountId: cleanId,
    };

    saveUserProfile(newUser);
    await fetchNearBalance(cleanId);
    setIsAuthModalOpen(false);
  };

  const signInWithEmail = async (email: string) => {
    const cleanEmail = email.trim();
    if (!cleanEmail) return;
    const name = cleanEmail.split("@")[0];
    const isAdmin = checkIsAdmin(cleanEmail, null, false);
    const defaultWallet = isAdmin ? DEFAULT_OWNER : `${name}.testnet`;

    const newUser: ScopeGuardUser = {
      id: `usr_email_${name}`,
      email: cleanEmail,
      displayName: name.charAt(0).toUpperCase() + name.slice(1),
      provider: "email",
      isAdmin,
      connectedWallets: isAdmin ? [DEFAULT_OWNER, "trader." + DEFAULT_OWNER] : [defaultWallet],
      activeAccountId: defaultWallet,
    };

    saveUserProfile(newUser);
    await fetchNearBalance(defaultWallet);
    setIsAuthModalOpen(false);
  };

  const signOut = () => {
    saveUserProfile(null);
    setNearBalance("--");
  };

  const linkSubAccount = async (account: string) => {
    const cleanAcc = account.trim();
    if (!cleanAcc || !user) return;
    if (user.connectedWallets.includes(cleanAcc)) {
      await setActiveWallet(cleanAcc);
      return;
    }
    const updatedWallets = [...user.connectedWallets, cleanAcc];
    const updatedUser: ScopeGuardUser = {
      ...user,
      connectedWallets: updatedWallets,
      activeAccountId: cleanAcc,
    };
    saveUserProfile(updatedUser);
    await fetchNearBalance(cleanAcc);
  };

  const unlinkSubAccount = (account: string) => {
    if (!user) return;
    const updatedWallets = user.connectedWallets.filter((w) => w !== account);
    const nextActive = updatedWallets[0] || "";
    const updatedUser: ScopeGuardUser = {
      ...user,
      connectedWallets: updatedWallets,
      activeAccountId: user.activeAccountId === account ? nextActive : user.activeAccountId,
    };
    saveUserProfile(updatedUser);
    if (nextActive) {
      fetchNearBalance(nextActive);
    } else {
      setNearBalance("--");
    }
  };

  const setActiveWallet = async (account: string) => {
    const cleanAcc = account.trim();
    if (!cleanAcc || !user) return;
    const updatedUser: ScopeGuardUser = {
      ...user,
      activeAccountId: cleanAcc,
    };
    saveUserProfile(updatedUser);
    await fetchNearBalance(cleanAcc);
  };

  const connectWallet = async (account: string) => {
    const cleanAcc = account.trim();
    if (!cleanAcc) return;
    if (user) {
      await linkSubAccount(cleanAcc);
    } else {
      await signInWithNear(cleanAcc);
    }
  };

  const disconnectWallet = () => {
    signOut();
  };

  const refreshBalance = async () => {
    if (user && user.activeAccountId) {
      await fetchNearBalance(user.activeAccountId);
    }
  };

  const accountId = user?.activeAccountId || "";
  const isConnected = !!user && !!user.activeAccountId;
  const isAuthenticated = !!user;
  const isAdmin = !!user && user.isAdmin;
  const connectedWallets = user?.connectedWallets || [];

  return (
    <WalletContext.Provider
      value={{
        user,
        isAuthenticated,
        isAdmin,
        signInWithSocial,
        signInWithNear,
        signInWithEmail,
        signOut,
        connectedWallets,
        linkSubAccount,
        unlinkSubAccount,
        setActiveWallet,
        accountId,
        isConnected,
        nearBalance,
        isLoadingBalance,
        connectWallet,
        disconnectWallet,
        refreshBalance,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
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

export const useAuth = (): WalletContextType => {
  return useWallet();
};
