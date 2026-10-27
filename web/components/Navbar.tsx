"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Sparkles, LayoutDashboard, PlusCircle, ExternalLink, Copy, Check, Lock } from "lucide-react";

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const [copied, setCopied] = useState(false);

  const copyContract = () => {
    navigator.clipboard.writeText("guard.sergeo-guard.testnet");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navLinks = [
    { href: "/", label: "Attack Simulator", icon: Sparkles },
    { href: "/dashboard", label: "Agent Dashboard", icon: LayoutDashboard },
    { href: "/create", label: "Create Agent Key", icon: PlusCircle },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm transition">
              <Shield className="w-5 h-5 fill-white/20" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900 tracking-tight">
                  ScopeGuard
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  NEAR Testnet
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Safe spending cards for autonomous AI agents
              </p>
            </div>
          </Link>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/80">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  isActive
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-emerald-600" : "text-slate-500"}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Info: Guard Contract on Testnet */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={copyContract}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-xs text-slate-700 transition shadow-sm"
            title="Copy Smart Contract address"
          >
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline text-slate-500">Guard:</span>
            <span className="font-mono text-slate-800 text-xs font-semibold">guard.sergeo-guard.testnet</span>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
            )}
          </button>

          <a
            href="https://testnet.nearblocks.io/address/guard.sergeo-guard.testnet"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition shadow-sm"
            title="Inspect on NearBlocks Explorer"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </header>
  );
};