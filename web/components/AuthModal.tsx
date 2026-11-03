"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Mail,
  ArrowLeft,
  ChevronRight,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";

interface WalletItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  actionType: "mynearwallet" | "injected";
}

export const AuthModal: React.FC = () => {
  const router = useRouter();
  const {
    isAuthModalOpen,
    closeAuthModal,
    signInWithSocial,
    signInWithNear,
    signInWithEmail,
  } = useWallet();

  const [isOpenLocal, setIsOpenLocal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [showNearStep, setShowNearStep] = useState(false);
  const [showCustomAccount, setShowCustomAccount] = useState(false);
  const [customAccountInput, setCustomAccountInput] = useState("");
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);

  // Synchronize with URL query parameter (?auth=1 / ?signin=1) and custom event
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (
        params.get("auth") === "1" ||
        params.get("signin") === "1" ||
        params.get("login") === "1"
      ) {
        setIsOpenLocal(true);
      }
      if (
        params.get("auth") === "near" ||
        params.get("wallet") === "near" ||
        params.get("connect") === "near"
      ) {
        setIsOpenLocal(true);
        setShowNearStep(true);
      }
      const handleOpen = () => setIsOpenLocal(true);
      const handleClose = () => setIsOpenLocal(false);
      window.addEventListener("scopeguard:open-auth", handleOpen);
      window.addEventListener("scopeguard:close-auth", handleClose);
      return () => {
        window.removeEventListener("scopeguard:open-auth", handleOpen);
        window.removeEventListener("scopeguard:close-auth", handleClose);
      };
    }
  }, []);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (isAuthModalOpen || isOpenLocal)) {
        handleDismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAuthModalOpen, isOpenLocal]);

  const handleDismiss = () => {
    closeAuthModal();
    setIsOpenLocal(false);
    setShowNearStep(false);
    setConnectionNotice(null);
  };

  const isVisible = isAuthModalOpen || isOpenLocal;
  if (!isVisible) return null;

  const handleGoogleSignIn = async () => {
    setLoadingProvider("google");
    try {
      const email = emailInput.trim();
      await signInWithSocial("google", email || undefined);
      handleDismiss();
      router.push("/dashboard");
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleGithubSignIn = async () => {
    setLoadingProvider("github");
    try {
      const email = emailInput.trim();
      await signInWithSocial("github", email || undefined);
      handleDismiss();
      router.push("/dashboard");
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setLoadingProvider("email");
    try {
      await signInWithEmail(emailInput.trim());
      setEmailInput("");
      handleDismiss();
      router.push("/dashboard");
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleConnectMyNearWallet = () => {
    setLoadingProvider("mynearwallet");
    setConnectionNotice("Opening MyNearWallet...");
    const contractId = "guard2.sergeo-guard.testnet";
    const currentOrigin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://scopeguard.blockframe.cloud";
    const successUrl = `${currentOrigin}/dashboard?wallet=mynearwallet&account_id=`;
    const failureUrl = `${currentOrigin}/?error=wallet_canceled`;
    const redirectUrl = `https://testnet.mynearwallet.com/login/?title=ScopeGuard&contract_id=${contractId}&success_url=${encodeURIComponent(
      successUrl
    )}&failure_url=${encodeURIComponent(failureUrl)}`;
    window.location.href = redirectUrl;
  };

  const handleConnectInjectedWallet = async (
    walletId: string,
    walletName: string
  ) => {
    setLoadingProvider(walletId);
    setConnectionNotice(`Connecting to ${walletName}...`);

    try {
      const anyWin = typeof window !== "undefined" ? (window as any) : null;
      let injectedProvider = null;

      if (walletId === "meteor" && anyWin?.meteorWallet) {
        injectedProvider = anyWin.meteorWallet;
      } else if (walletId === "here" && anyWin?.hereWallet) {
        injectedProvider = anyWin.hereWallet;
      } else if (walletId === "sender" && anyWin?.near?.isSender) {
        injectedProvider = anyWin.near;
      } else if (
        walletId === "nightly" &&
        (anyWin?.nightly?.near || anyWin?.nightly)
      ) {
        injectedProvider = anyWin.nightly.near || anyWin.nightly;
      } else if (walletId === "ledger") {
        setConnectionNotice(
          "Connect your Ledger via USB, open NEAR app, and approve access."
        );
        return;
      } else if (anyWin?.near) {
        injectedProvider = anyWin.near;
      }

      if (
        injectedProvider &&
        typeof injectedProvider.requestSignIn === "function"
      ) {
        const res = await injectedProvider.requestSignIn({
          contractId: "guard2.sergeo-guard.testnet",
        });
        const accId = res?.accountId || anyWin?.near?.accountId;
        if (accId) {
          await signInWithNear(accId);
          handleDismiss();
          router.push("/dashboard");
          return;
        }
      }

      setConnectionNotice(
        `${walletName} extension not detected. Connect via MyNearWallet or install the extension.`
      );
    } catch (err: any) {
      setConnectionNotice(
        `Connection declined: ${err.message || "User canceled"}`
      );
    } finally {
      setTimeout(() => setLoadingProvider(null), 1000);
    }
  };

  const handleDirectPresetConnect = async (accId: string) => {
    setLoadingProvider(accId);
    try {
      await signInWithNear(accId);
      handleDismiss();
      router.push("/dashboard");
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleCustomAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAccountInput.trim()) return;
    setLoadingProvider("custom");
    try {
      await signInWithNear(customAccountInput.trim());
      handleDismiss();
      router.push("/dashboard");
    } finally {
      setLoadingProvider(null);
    }
  };

  // Check if browser extensions are present
  const anyWin = typeof window !== "undefined" ? (window as any) : null;
  const isMeteorDetected = !!anyWin?.meteorWallet;
  const isHereDetected = !!anyWin?.hereWallet;
  const isSenderDetected = !!anyWin?.near?.isSender;
  const isNightlyDetected = !!(anyWin?.nightly?.near || anyWin?.nightly);

  const walletOptions: WalletItem[] = [
    {
      id: "mynearwallet",
      name: "MyNearWallet",
      icon: (
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none">
            <path
              d="M7.74 5.25L13.56 13.58C13.8 13.92 14.28 13.76 14.28 13.34V5.45C14.28 5.2 14.48 5 14.73 5H16.27C16.52 5 16.72 5.2 16.72 5.45V18.55C16.72 18.8 16.52 19 16.27 19H15.01C14.65 19 14.32 18.82 14.13 18.51L8.31 10.18C8.07 9.84 7.59 10 7.59 10.42V18.55C7.59 18.8 7.39 19 7.14 19H5.6C5.35 19 5.15 18.8 5.15 18.55V5.45C5.15 5.2 5.35 5 5.6 5H6.86C7.22 5 7.55 5.18 7.74 5.25Z"
              fill="currentColor"
            />
          </svg>
        </div>
      ),
      actionType: "mynearwallet",
    },
    {
      id: "meteor",
      name: "Meteor Wallet",
      icon: (
        <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-rose-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L14.4 8.6L21.5 9.2L16.2 14L17.8 21L12 17.3L6.2 21L7.8 14L2.5 9.2L9.6 8.6L12 2Z" />
          </svg>
        </div>
      ),
      actionType: "injected",
    },
    {
      id: "here",
      name: "HERE Wallet",
      icon: (
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
          <svg
            className="w-4 h-4 text-amber-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M7 6V18M17 6V18M7 12H17" />
          </svg>
        </div>
      ),
      actionType: "injected",
    },
    {
      id: "sender",
      name: "Sender Wallet",
      icon: (
        <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
          <svg
            className="w-4 h-4 text-teal-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 3L6 14H13L11 21L18 10H11L13 3Z" />
          </svg>
        </div>
      ),
      actionType: "injected",
    },
    {
      id: "nightly",
      name: "Nightly Wallet",
      icon: (
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 6C10.6863 6 8 8.68629 8 12C8 15.3137 10.6863 18 14 18C15.3867 18 16.6661 17.5312 17.6875 16.75C14.7335 16.3533 12.5 13.9048 12.5 11C12.5 8.0952 14.7335 5.6467 17.6875 5.25C16.6661 4.4688 15.3867 4 14 4Z" />
          </svg>
        </div>
      ),
      actionType: "injected",
    },
    {
      id: "ledger",
      name: "Ledger Hardware",
      icon: (
        <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
          <svg
            className="w-4 h-4 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M7 8V6H11M13 6H17V8M7 16V18H11M13 18H17V16" />
          </svg>
        </div>
      ),
      actionType: "injected",
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to ScopeGuard"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={handleDismiss}
    >
      <div
        className="w-full max-w-[390px] rounded-2xl bg-[#090B10] border border-white/[0.08] p-5 sm:p-6 shadow-2xl text-white relative space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {!showNearStep ? (
          /* Step 1: Primary Authentication Options */
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Sign in to ScopeGuard</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Connect your wallet or account to continue
                </p>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                className="p-1 -mr-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Featured NEAR Button */}
            <button
              type="button"
              onClick={() => {
                setConnectionNotice(null);
                setShowNearStep(true);
              }}
              disabled={!!loadingProvider}
              className="w-full h-12 rounded-xl bg-white hover:bg-slate-200 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2.5 transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7.74 5.25L13.56 13.58C13.8 13.92 14.28 13.76 14.28 13.34V5.45C14.28 5.2 14.48 5 14.73 5H16.27C16.52 5 16.72 5.2 16.72 5.45V18.55C16.72 18.8 16.52 19 16.27 19H15.01C14.65 19 14.32 18.82 14.13 18.51L8.31 10.18C8.07 9.84 7.59 10 7.59 10.42V18.55C7.59 18.8 7.39 19 7.14 19H5.6C5.35 19 5.15 18.8 5.15 18.55V5.45C5.15 5.2 5.35 5 5.6 5H6.86C7.22 5 7.55 5.18 7.74 5.25Z"
                  fill="currentColor"
                />
              </svg>
              <span>Connect NEAR Wallet</span>
            </button>

            {/* Social Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={!!loadingProvider}
                className="h-11 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-white/20 text-xs font-medium text-slate-200 hover:text-white flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Google</span>
              </button>

              <button
                type="button"
                onClick={handleGithubSignIn}
                disabled={!!loadingProvider}
                className="h-11 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-white/20 text-xs font-medium text-slate-200 hover:text-white flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0 text-white fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                <span>GitHub</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex items-center py-1">
              <div className="flex-1 border-t border-white/[0.06]" />
              <span className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                or email
              </span>
              <div className="flex-1 border-t border-white/[0.06]" />
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailSubmit} className="space-y-2">
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-11 pl-10 pr-3 rounded-xl bg-white/[0.03] border border-white/[0.08] focus:border-blue-500 text-xs text-white placeholder-slate-500 outline-none transition"
                />
              </div>
              <button
                type="submit"
                disabled={!emailInput.trim() || !!loadingProvider}
                className="w-full h-10 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-slate-200 hover:text-white transition cursor-pointer disabled:opacity-40"
              >
                {loadingProvider === "email" ? "Signing in..." : "Continue with Email"}
              </button>
            </form>
          </div>
        ) : (
          /* Step 2: Minimalist, World-Class NEAR Wallet Selector */
          <div className="space-y-3 animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
              <button
                type="button"
                onClick={() => {
                  setShowNearStep(false);
                  setConnectionNotice(null);
                }}
                className="p-1 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition cursor-pointer"
                aria-label="Back to sign in options"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h3 className="text-sm font-semibold text-white">Connect NEAR Wallet</h3>
              <button
                type="button"
                onClick={handleDismiss}
                className="p-1 -mr-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sleek List of Wallets (No Clunky Boxes, No Marketing Bloat) */}
            <div className="space-y-0.5">
              {walletOptions.map((w) => {
                const isDetected =
                  (w.id === "meteor" && isMeteorDetected) ||
                  (w.id === "here" && isHereDetected) ||
                  (w.id === "sender" && isSenderDetected) ||
                  (w.id === "nightly" && isNightlyDetected);

                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      if (w.actionType === "mynearwallet") {
                        handleConnectMyNearWallet();
                      } else {
                        handleConnectInjectedWallet(w.id, w.name);
                      }
                    }}
                    disabled={!!loadingProvider}
                    className="w-full h-11 px-2.5 rounded-xl hover:bg-white/[0.06] text-left transition flex items-center justify-between cursor-pointer group disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      {w.icon}
                      <span className="text-xs font-medium text-slate-200 group-hover:text-white transition">
                        {w.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isDetected ? (
                        <span className="text-[10px] font-mono font-medium text-mint-green px-1.5 py-0.5 rounded bg-mint-green/10">
                          Detected
                        </span>
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Connection Status or Error */}
            {connectionNotice && (
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-start gap-2 text-xs text-slate-300">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                <span>{connectionNotice}</span>
              </div>
            )}

            {/* Discreet Testnet Sandbox Section */}
            <div className="pt-3 border-t border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Testnet Sandbox</span>
                <button
                  type="button"
                  onClick={() => setShowCustomAccount(!showCustomAccount)}
                  className="text-slate-400 hover:text-white transition"
                >
                  {showCustomAccount ? "Cancel" : "Manual ID"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDirectPresetConnect("sergeo-guard.testnet")}
                  className="px-2.5 py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/20 text-left transition cursor-pointer group"
                >
                  <div className="text-[11px] font-mono text-slate-200 group-hover:text-white truncate">
                    sergeo-guard.testnet
                  </div>
                  <div className="text-[10px] text-slate-500">Owner Account</div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleDirectPresetConnect("trader.sergeo-guard.testnet")
                  }
                  className="px-2.5 py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/20 text-left transition cursor-pointer group"
                >
                  <div className="text-[11px] font-mono text-slate-200 group-hover:text-white truncate">
                    trader.sergeo-guard...
                  </div>
                  <div className="text-[10px] text-slate-500">Agent Account</div>
                </button>
              </div>

              {showCustomAccount && (
                <form
                  onSubmit={handleCustomAccountSubmit}
                  className="pt-1 flex gap-2"
                >
                  <input
                    type="text"
                    value={customAccountInput}
                    onChange={(e) => setCustomAccountInput(e.target.value)}
                    placeholder="account.testnet"
                    className="flex-1 h-9 px-3 rounded-lg border border-white/[0.08] bg-black/40 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!customAccountInput.trim()}
                    className="px-3 h-9 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-xs font-medium text-white transition disabled:opacity-40"
                  >
                    Connect
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
