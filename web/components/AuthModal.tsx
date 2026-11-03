"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Mail } from "lucide-react";
import { useWallet } from "@/context/WalletContext";

export const AuthModal: React.FC = () => {
  const router = useRouter();
  const {
    isAuthModalOpen,
    closeAuthModal,
    signInWithSocial,
    signInWithEmail,
    openNearWalletModal,
  } = useWallet();

  const [isOpenLocal, setIsOpenLocal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  // Synchronize with URL query parameter (?auth=1 / ?signin=1 / ?auth=near)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (
        params.get("auth") === "near" ||
        params.get("wallet") === "near" ||
        params.get("connect") === "near"
      ) {
        openNearWalletModal();
        return;
      }
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
  }, [openNearWalletModal]);

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
  };

  const isVisible = isAuthModalOpen || isOpenLocal;
  if (!isVisible) return null;

  const handleConnectNear = () => {
    handleDismiss();
    openNearWalletModal();
  };

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to ScopeGuard"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={handleDismiss}
    >
      <div
        className="w-full max-w-[380px] rounded-2xl bg-[#090B10] border border-white/[0.08] p-6 shadow-2xl text-white relative space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Sign in to ScopeGuard</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Connect your NEAR wallet or sign in with an account
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

        {/* Primary Action: Official NEAR Wallet Selector */}
        <button
          type="button"
          onClick={handleConnectNear}
          className="w-full h-12 rounded-xl bg-white hover:bg-slate-200 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2.5 transition shadow-sm cursor-pointer"
        >
          <svg className="w-4 h-4 text-black" viewBox="0 0 24 24" fill="none">
            <path
              d="M7.74 5.25L13.56 13.58C13.8 13.92 14.28 13.76 14.28 13.34V5.45C14.28 5.2 14.48 5 14.73 5H16.27C16.52 5 16.72 5.2 16.72 5.45V18.55C16.72 18.8 16.52 19 16.27 19H15.01C14.65 19 14.32 18.82 14.13 18.51L8.31 10.18C8.07 9.84 7.59 10 7.59 10.42V18.55C7.59 18.8 7.39 19 7.14 19H5.6C5.35 19 5.15 18.8 5.15 18.55V5.45C5.15 5.2 5.35 5 5.6 5H6.86C7.22 5 7.55 5.18 7.74 5.25Z"
              fill="currentColor"
            />
          </svg>
          <span>Connect NEAR Wallet</span>
        </button>

        {/* Social Authentication */}
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
    </div>
  );
};
