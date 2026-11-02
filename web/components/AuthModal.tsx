"use client";

import React, { useState } from "react";
import {
  X,
  Mail,
  Github,
  ShieldCheck,
  Check,
  ArrowRight,
  Sparkles,
  UserCheck,
  Lock,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    closeAuthModal,
    signInWithSocial,
    signInWithNear,
    signInWithEmail,
  } = useWallet();

  const [emailInput, setEmailInput] = useState("");
  const [showNearInput, setShowNearInput] = useState(false);
  const [nearAccountInput, setNearAccountInput] = useState("sergeo-guard.testnet");
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  // Close modal on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isAuthModalOpen) {
        closeAuthModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const handleGoogleSignIn = async () => {
    setLoadingProvider("google");
    try {
      const email = emailInput.trim() || "sergeo@scopeguard.io";
      await signInWithSocial("google", email);
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleGithubSignIn = async () => {
    setLoadingProvider("github");
    try {
      const email = emailInput.trim() || "sergeo@github.com";
      await signInWithSocial("github", email);
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleNearSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoadingProvider("near");
    try {
      await signInWithNear(nearAccountInput.trim() || "sergeo-guard.testnet");
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
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleDemoPreset = async (role: "admin" | "user") => {
    setLoadingProvider(role);
    try {
      if (role === "admin") {
        await signInWithSocial("google", "sergeo@scopeguard.io");
      } else {
        await signInWithEmail("alice.trader@example.com");
      }
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to ScopeGuard"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={closeAuthModal}
    >
      <div
        className="w-full max-w-[420px] rounded-3xl bg-[#0D1117] border border-slate-800 p-6 sm:p-7 shadow-2xl space-y-4 text-white relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={closeAuthModal}
          className="absolute right-5 top-5 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          aria-label="Close authentication modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              ScopeGuard Unified Access
            </span>
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-white">
            Sign in to ScopeGuard
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Manage your passkeys, multi-account wallets, and agent policies from one place.
          </p>
        </div>

        {/* Primary Social & Chain Login Options (Matching Screenshot) */}
        <div className="space-y-3 pt-1">
          {/* Continue with Google */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={!!loadingProvider}
            className="w-full h-12 px-4 rounded-2xl bg-[#0D1117] hover:bg-[#161B22] border border-slate-700/70 hover:border-slate-500 text-sm font-semibold text-white flex items-center justify-center gap-3 transition shadow-xs cursor-pointer disabled:opacity-50"
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
            <span>{loadingProvider === "google" ? "Connecting..." : "Continue with Google"}</span>
          </button>

          {/* Continue with NEAR */}
          {!showNearInput ? (
            <button
              type="button"
              onClick={() => setShowNearInput(true)}
              disabled={!!loadingProvider}
              className="w-full h-12 px-4 rounded-2xl bg-[#0D1117] hover:bg-[#161B22] border border-slate-700/70 hover:border-slate-500 text-sm font-semibold text-white flex items-center justify-center gap-3 transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              <div className="w-5 h-5 rounded-md bg-[#00EC97] flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-black" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.17 3.5H5.83C4.54 3.5 3.5 4.54 3.5 5.83v12.34c0 1.29 1.04 2.33 2.33 2.33h12.34c1.29 0 2.33-1.04 2.33-2.33V5.83c0-1.29-1.04-2.33-2.33-2.33zm-.8 13.97l-5.63-8.08c-.24-.34-.73-.18-.73.24v7.84H9.3V7.53h1.71l5.63 8.08c.24.34.73.18.73-.24V7.53h1.71v9.94h-1.71z" />
                </svg>
              </div>
              <span>Continue with NEAR</span>
            </button>
          ) : (
            <form onSubmit={handleNearSubmit} className="space-y-2 p-3 rounded-2xl bg-[#161B22] border border-emerald-500/40">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-emerald-400">
                  NEAR Testnet Account ID:
                </label>
                <button
                  type="button"
                  onClick={() => setShowNearInput(false)}
                  className="text-[10px] text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nearAccountInput}
                  onChange={(e) => setNearAccountInput(e.target.value)}
                  placeholder="e.g. sergeo-guard.testnet"
                  className="flex-1 px-3 py-2 text-xs font-mono rounded-xl bg-[#0D1117] border border-slate-700 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loadingProvider === "near"}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  {loadingProvider === "near" ? "..." : "Connect"}
                </button>
              </div>
            </form>
          )}

          {/* Continue with GitHub */}
          <button
            type="button"
            onClick={handleGithubSignIn}
            disabled={!!loadingProvider}
            className="w-full h-12 px-4 rounded-2xl bg-[#0D1117] hover:bg-[#161B22] border border-slate-700/70 hover:border-slate-500 text-sm font-semibold text-white flex items-center justify-center gap-3 transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Github className="w-4 h-4 shrink-0 text-white" />
            <span>{loadingProvider === "github" ? "Connecting..." : "Continue with GitHub"}</span>
          </button>
        </div>

        {/* OR Divider */}
        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest text-slate-500">
            <span className="bg-[#0D1117] px-3">OR</span>
          </div>
        </div>

        {/* Email Form */}
        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Email address"
              className="w-full h-12 pl-11 pr-4 rounded-2xl bg-[#0D1117] border border-slate-700/70 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={!emailInput.trim() || !!loadingProvider}
            className={`w-full h-12 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              emailInput.trim() && !loadingProvider
                ? "bg-white text-slate-950 hover:bg-slate-200 shadow-md"
                : "bg-[#13171F] text-slate-500 border border-slate-800 cursor-not-allowed"
            }`}
          >
            <span>{loadingProvider === "email" ? "Signing in..." : "Continue with Email"}</span>
            {emailInput.trim() && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        {/* Quick Test Identities for Evaluation & Admin Detection */}
        <div className="pt-3 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-semibold">Quick Switch Demo Roles:</span>
            <span className="text-[10px] text-slate-500">1-click test</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleDemoPreset("admin")}
              className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer text-left"
              title="Sign in as Sergeo with Admin Cockpit permissions"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">Admin (Sergeo)</span>
            </button>

            <button
              type="button"
              onClick={() => handleDemoPreset("user")}
              className="px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer text-left"
              title="Sign in as a standard user with client-only permissions"
            >
              <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">Client (Alice)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
