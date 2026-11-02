"use client";

import React from "react";
import Link from "next/link";
import {
  Shield,
  ExternalLink,
  Github,
  BookOpen,
  Terminal,
  Activity,
  Layers,
  Sparkles,
} from "lucide-react";
import { ScopeGuardLogo } from "@/components/ScopeGuardLogo";
import { useDocs } from "@/context/DocsContext";

export const MarketingFooter: React.FC = () => {
  const { openDocs } = useDocs();

  return (
    <footer className="w-full border-t border-slate-800 bg-[#05070A] text-slate-400 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Main 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <ScopeGuardLogo size={32} className="w-8 h-8" />
              <span className="text-xl font-extrabold tracking-tight text-white">
                Scope<span className="text-blue-500">Guard</span>
              </span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
              Give your AI agent power over money without the power to lose everything. Protocol-level scoped spending passkeys and onchain policy enforcement on NEAR Protocol.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>NEAR Testnet Active</span>
              </div>
              <span className="text-xs text-slate-500 font-mono">block #182M+</span>
            </div>
          </div>

          {/* Product Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Product
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#arena" className="hover:text-white transition">
                  Live Attack Arena
                </a>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-white transition">
                  Security Console
                </Link>
              </li>
              <li>
                <Link href="/create" className="hover:text-white transition">
                  Issue Passkey
                </Link>
              </li>
              <li>
                <a href="#bento" className="hover:text-white transition">
                  10-Layer Policy Radar
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-white transition">
                  3-Step Protocol Setup
                </a>
              </li>
            </ul>
          </div>

          {/* Onchain Checks */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Security Layers
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <span className="hover:text-white transition cursor-default">
                  Rule 1: Registered Agent
                </span>
              </li>
              <li>
                <span className="hover:text-white transition cursor-default">
                  Rule 3: Velocity Anti-Spam
                </span>
              </li>
              <li>
                <span className="hover:text-white transition cursor-default">
                  Rule 4: Contract Allowlist
                </span>
              </li>
              <li>
                <span className="hover:text-white transition cursor-default">
                  Rule 6: Daily Budget Cap
                </span>
              </li>
              <li>
                <span className="hover:text-white transition cursor-default">
                  Rule 8: Timelock Quarantine
                </span>
              </li>
            </ul>
          </div>

          {/* Resources & Open Source */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Resources
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  type="button"
                  onClick={openDocs}
                  className="hover:text-white transition flex items-center gap-1 text-left"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Technical Documentation</span>
                </button>
              </li>
              <li>
                <a
                  href="https://github.com/Sergeo01/Scopeguard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition flex items-center gap-1"
                >
                  <Github className="w-3.5 h-3.5" />
                  <span>GitHub Repository</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a
                  href="https://testnet.nearblocks.io/address/guard2.sergeo-guard.testnet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition flex items-center gap-1"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Contract on Explorer</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a
                  href="https://near.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition flex items-center gap-1"
                >
                  <span>Built on NEAR Protocol</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Metadata & Copyright */}
        <div className="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            © {new Date().getFullYear()} ScopeGuard. Built for the NEAR Build Beyond Boundaries Hackathon.
          </p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Smart Contract: guard2.sergeo-guard.testnet</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
