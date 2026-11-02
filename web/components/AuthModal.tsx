"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Mail,
  ArrowLeft,
  Wallet,
  ExternalLink,
  ChevronRight,
  Shield,
  CheckCircle2,
  AlertCircle,
  Terminal,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";

interface WalletOption {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
  icon: string;
  actionType: "mynearwallet" | "injected" | "preset";
  presetAccount?: string;
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
  const [showDeveloperMode, setShowDeveloperMode] = useState(false);
  const [nearAccountInput, setNearAccountInput] = useState("");
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);

  // Synchronize with URL query parameter (?auth=1 / ?signin=1) and custom event
  React.useEffect(() => {
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
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (isAuthModalOpen || isOpenLocal)) {
        closeAuthModal();
        setIsOpenLocal(false);
        setShowNearStep(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAuthModalOpen, isOpenLocal, closeAuthModal]);

  const isVisible = isAuthModalOpen || isOpenLocal;
  if (!isVisible) return null;

  const handleGoogleSignIn = async () => {
    setLoadingProvider("google");
    try {
      const email = emailInput.trim();
      await signInWithSocial("google", email || undefined);
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
      router.push("/dashboard");
    } finally {
      setLoadingProvider(null);
    }
  };

  // Direct Wallet Handlers
  const handleConnectMyNearWallet = () => {
    setLoadingProvider("mynearwallet");
    setConnectionNotice("Redirecting to MyNearWallet for protocol authorization...");
    const contractId = "guard2.sergeo-guard.testnet";
    const currentOrigin = typeof window !== "undefined" ? window.location.origin : "https://scopeguard.blockframe.cloud";
    const successUrl = `${currentOrigin}/dashboard?wallet=mynearwallet&account_id=`;
    const failureUrl = `${currentOrigin}/?error=wallet_canceled`;
    const redirectUrl = `https://testnet.mynearwallet.com/login/?title=ScopeGuard&contract_id=${contractId}&success_url=${encodeURIComponent(successUrl)}&failure_url=${encodeURIComponent(failureUrl)}`;
    window.location.href = redirectUrl;
  };

  const handleConnectInjectedWallet = async (walletId: string, walletName: string) => {
    setLoadingProvider(walletId);
    setConnectionNotice(`Requesting authorization from ${walletName}...`);

    try {
      const anyWin = typeof window !== "undefined" ? (window as any) : null;
      let injectedProvider = null;

      if (walletId === "meteor" && anyWin?.meteorWallet) {
        injectedProvider = anyWin.meteorWallet;
      } else if (walletId === "here" && anyWin?.hereWallet) {
        injectedProvider = anyWin.hereWallet;
      } else if (walletId === "sender" && anyWin?.near?.isSender) {
        injectedProvider = anyWin.near;
      } else if (anyWin?.near) {
        injectedProvider = anyWin.near;
      }

      if (injectedProvider && typeof injectedProvider.requestSignIn === "function") {
        const res = await injectedProvider.requestSignIn({
          contractId: "guard2.sergeo-guard.testnet",
        });
        const accId = res?.accountId || anyWin?.near?.accountId;
        if (accId) {
          await signInWithNear(accId);
          setShowNearStep(false);
          router.push("/dashboard");
          return;
        }
      }

      // If extension not installed in browser, inform user cleanly
      setConnectionNotice(`${walletName} extension not detected. Please install extension or connect via MyNearWallet.`);
    } catch (err: any) {
      setConnectionNotice(`Failed to connect with ${walletName}: ${err.message || "Request declined"}`);
    } finally {
      setTimeout(() => setLoadingProvider(null), 1000);
    }
  };

  const handleDirectPresetConnect = async (accId: string) => {
    setLoadingProvider(accId);
    try {
      await signInWithNear(accId);
      setShowNearStep(false);
      router.push("/dashboard");
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleManualAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nearAccountInput.trim()) return;
    setLoadingProvider("manual");
    try {
      await signInWithNear(nearAccountInput.trim());
      setShowNearStep(false);
      router.push("/dashboard");
    } finally {
      setLoadingProvider(null);
    }
  };

  const directWallets: WalletOption[] = [
    {
      id: "mynearwallet",
      name: "MyNearWallet",
      badge: "Web Wallet",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      description: "Direct web authentication, works on all browsers and mobile",
      icon: "MNW",
      actionType: "mynearwallet",
    },
    {
      id: "meteor",
      name: "Meteor Wallet",
      badge: "Extension / Web",
      badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      description: "Direct authorization for Meteor extension and web app",
      icon: "MET",
      actionType: "injected",
    },
    {
      id: "here",
      name: "Here Wallet",
      badge: "Mobile QR / Web",
      badgeColor: "bg-slate-500/10 text-slate-300 border-slate-500/20",
      description: "Mobile app biometric verification and web connect",
      icon: "HERE",
      actionType: "injected",
    },
    {
      id: "sender",
      name: "Sender Wallet",
      badge: "Extension",
      badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      description: "Fast in-browser signing via Sender Chrome extension",
      icon: "SND",
      actionType: "injected",
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to ScopeGuard"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => {
        closeAuthModal();
        setIsOpenLocal(false);
        setShowNearStep(false);
      }}
    >
      <div
        className="w-full max-w-[440px] rounded-[24px] bg-[#080A0F] border border-[#1E222D] p-6 sm:p-7 shadow-2xl text-white relative space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Close Button */}
        <button
          type="button"
          onClick={() => {
            closeAuthModal();
            setIsOpenLocal(false);
            setShowNearStep(false);
          }}
          className="absolute right-5 top-5 p-1 rounded-full text-slate-500 hover:text-white hover:bg-slate-800/60 transition cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {!showNearStep ? (
          <>
            {/* 1. Continue with Google */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={!!loadingProvider}
              className="w-full h-[52px] rounded-[16px] border border-[#1E222D] bg-[#080A0F] hover:bg-[#11141D] hover:border-[#2D3344] text-[14.5px] font-semibold text-white flex items-center justify-center gap-3 transition cursor-pointer disabled:opacity-50"
            >
              <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24">
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
              <span>{loadingProvider === "google" ? "Connecting..." : "Continue with Google"}</span>
            </button>

            {/* 2. Continue with NEAR */}
            <button
              type="button"
              onClick={() => {
                setConnectionNotice(null);
                setShowNearStep(true);
              }}
              disabled={!!loadingProvider}
              className="w-full h-[52px] rounded-[16px] border border-[#1E222D] bg-[#080A0F] hover:bg-[#11141D] hover:border-[#2D3344] text-[14.5px] font-semibold text-white flex items-center justify-center gap-3 transition cursor-pointer disabled:opacity-50"
            >
              <div className="w-[22px] h-[22px] rounded-[5px] bg-[#56F39A] flex items-center justify-center shrink-0">
                <svg className="w-[14px] h-[14px] text-black" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.37 17.47l-5.63-8.08c-.24-.34-.73-.18-.73.24v7.84H9.3V7.53h1.71l5.63 8.08c.24.34.73.18.73-.24V7.53h1.71v9.94h-1.71z" />
                </svg>
              </div>
              <span>Continue with NEAR</span>
            </button>

            {/* 3. Continue with GitHub */}
            <button
              type="button"
              onClick={handleGithubSignIn}
              disabled={!!loadingProvider}
              className="w-full h-[52px] rounded-[16px] border border-[#1E222D] bg-[#080A0F] hover:bg-[#11141D] hover:border-[#2D3344] text-[14.5px] font-semibold text-white flex items-center justify-center gap-3 transition cursor-pointer disabled:opacity-50"
            >
              <svg className="w-[19px] h-[19px] shrink-0 text-white fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>{loadingProvider === "github" ? "Connecting..." : "Continue with GitHub"}</span>
            </button>

            {/* 4. OR Divider */}
            <div className="w-full flex items-center my-1.5">
              <div className="flex-1 h-[1px] bg-[#181C26]" />
              <div className="px-4 text-[11px] font-bold text-[#4B5565] tracking-wider uppercase">
                OR
              </div>
              <div className="flex-1 h-[1px] bg-[#181C26]" />
            </div>

            {/* 5. Email Address Input */}
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <div className="relative">
                <Mail className="w-[17px] h-[17px] text-[#4B5565] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Email address"
                  className="w-full h-[52px] pl-11 pr-4 rounded-[16px] border border-[#1E222D] bg-[#080A0F] text-[14.5px] text-white placeholder-[#3F4656] focus:outline-none focus:border-slate-500 transition"
                />
              </div>

              {/* 6. Continue with Email Button */}
              <button
                type="submit"
                disabled={!emailInput.trim() || !!loadingProvider}
                className={`w-full h-[52px] rounded-[16px] text-[14.5px] font-semibold flex items-center justify-center transition ${
                  emailInput.trim() && !loadingProvider
                    ? "bg-white text-slate-950 hover:bg-slate-200 cursor-pointer shadow-lg"
                    : "border border-[#161922] bg-[#0A0C12] text-[#383F4F] cursor-not-allowed"
                }`}
              >
                <span>{loadingProvider === "email" ? "Signing in..." : "Continue with Email"}</span>
              </button>
            </form>
          </>
        ) : (
          /* Direct NEAR Wallets Selector (Connecting Directly Without Pasting Username) */
          <div className="space-y-3 pt-1 animate-in fade-in duration-150">
            {/* Header with Back button */}
            <div className="flex items-center justify-between pb-1">
              <button
                type="button"
                onClick={() => {
                  setShowNearStep(false);
                  setConnectionNotice(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#56F39A]" />
                <span className="text-[11px] font-mono text-[#56F39A]">Direct Connect</span>
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Select a NEAR Wallet</h3>
              <p className="text-[11px] text-slate-400">
                Connect directly using your preferred Web3 wallet:
              </p>
            </div>

            {/* Direct Wallet Cards */}
            <div className="space-y-2">
              {directWallets.map((w) => (
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
                  className="w-full p-3 rounded-[14px] border border-[#1E222D] bg-[#0C0F17] hover:bg-[#121622] hover:border-[#2E3547] text-left transition flex items-center justify-between gap-3 cursor-pointer group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#161B28] border border-slate-700/60 flex items-center justify-center font-bold font-mono text-[11px] text-emerald-400 shrink-0">
                      {w.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition">
                          {w.name}
                        </span>
                        <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${w.badgeColor}`}>
                          {w.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                        {w.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition shrink-0" />
                </button>
              ))}
            </div>

            {/* Connection Notice or Status Alert */}
            {connectionNotice && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2 text-[11px] text-amber-300">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                <span>{connectionNotice}</span>
              </div>
            )}

            {/* Quick Sandbox / Preset Demo Wallets */}
            <div className="pt-2 border-t border-[#181C26] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  Quick Sandbox Accounts
                </span>
                <button
                  type="button"
                  onClick={() => setShowDeveloperMode(!showDeveloperMode)}
                  className="text-[10px] text-slate-400 hover:text-white transition cursor-pointer"
                >
                  {showDeveloperMode ? "Hide Custom" : "Custom Account"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDirectPresetConnect("sergeo-guard.testnet")}
                  className="px-2.5 py-2 rounded-xl bg-[#0D111A] hover:bg-[#161D2C] border border-[#1E222D] text-left transition cursor-pointer"
                >
                  <div className="text-[10px] font-bold text-emerald-400">sergeo-guard.testnet</div>
                  <div className="text-[9px] text-slate-400">Owner &amp; Admin Key</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleDirectPresetConnect("trader.sergeo-guard.testnet")}
                  className="px-2.5 py-2 rounded-xl bg-[#0D111A] hover:bg-[#161D2C] border border-[#1E222D] text-left transition cursor-pointer"
                >
                  <div className="text-[10px] font-bold text-blue-400">trader.sergeo...</div>
                  <div className="text-[9px] text-slate-400">MockDEX Trading Sub-Account</div>
                </button>
              </div>

              {/* Expandable Manual Account ID Input */}
              {showDeveloperMode && (
                <form onSubmit={handleManualAccountSubmit} className="pt-1 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={nearAccountInput}
                      onChange={(e) => setNearAccountInput(e.target.value)}
                      placeholder="e.g. your-name.testnet"
                      className="flex-1 h-9 px-3 rounded-xl border border-[#1E222D] bg-[#0A0C12] text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                    />
                    <button
                      type="submit"
                      disabled={!nearAccountInput.trim() || loadingProvider === "manual"}
                      className="px-3 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition cursor-pointer disabled:opacity-50"
                    >
                      Connect
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
