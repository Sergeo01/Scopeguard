"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Mail, ArrowLeft } from "lucide-react";
import { useWallet } from "@/context/WalletContext";

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
  const [nearAccountInput, setNearAccountInput] = useState("");
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

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

  const handleNearSubmit = async (e?: React.FormEvent, directAccount?: string) => {
    if (e) e.preventDefault();
    const accountToConnect = directAccount || nearAccountInput.trim() || "sergeo-guard.testnet";
    setLoadingProvider("near");
    try {
      await signInWithNear(accountToConnect);
      setShowNearStep(false);
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
              onClick={() => setShowNearStep(true)}
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
          /* Smooth NEAR Connection Sub-step */
          <div className="space-y-4 pt-1 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowNearStep(false)}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#56F39A]" />
                <span className="text-[11px] font-mono text-[#56F39A]">NEAR Account</span>
              </div>
            </div>

            <form onSubmit={(e) => handleNearSubmit(e)} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Enter your NEAR Account ID:
                </label>
                <input
                  type="text"
                  value={nearAccountInput}
                  onChange={(e) => setNearAccountInput(e.target.value)}
                  placeholder="e.g. sergeo-guard.testnet"
                  className="w-full h-[48px] px-4 rounded-[14px] border border-[#1E222D] bg-[#0B0E14] text-sm text-white font-mono placeholder-[#3F4656] focus:outline-none focus:border-[#56F39A] transition"
                  autoFocus
                />
              </div>

              {/* Quick Select Preset Accounts */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-500 font-medium">Quick connect:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleNearSubmit(undefined, "sergeo-guard.testnet")}
                    className="px-2.5 py-1 rounded-lg bg-[#11141D] hover:bg-[#181D2A] border border-[#1E222D] text-[11px] font-mono text-slate-300 transition cursor-pointer"
                  >
                    sergeo-guard.testnet (Admin)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNearSubmit(undefined, "trader.sergeo-guard.testnet")}
                    className="px-2.5 py-1 rounded-lg bg-[#11141D] hover:bg-[#181D2A] border border-[#1E222D] text-[11px] font-mono text-slate-300 transition cursor-pointer"
                  >
                    trader.testnet
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loadingProvider === "near"}
                className="w-full h-[48px] rounded-[14px] bg-[#56F39A] hover:bg-[#47E58B] text-slate-950 text-sm font-bold flex items-center justify-center transition cursor-pointer disabled:opacity-50"
              >
                <span>{loadingProvider === "near" ? "Connecting..." : "Connect NEAR Account"}</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
