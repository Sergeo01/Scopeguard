"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  ExternalLink,
  Shield,
  Palette,
  Search,
  Lock,
  Coins,
  LogOut,
  ChevronRight,
  Terminal,
  Activity,
  Layers,
  Sliders,
  BookOpen,
  Github,
  Twitter,
} from "lucide-react";
import { ScopeGuardLogo } from "@/components/ScopeGuardLogo";
import { tryGetPolicyContractId } from "@/lib/config";
import { useWallet } from "@/context/WalletContext";
import { useLogo } from "@/context/LogoContext";
import { ThemeToggle } from "@/components/ThemeToggle";

interface NavItem {
  href: string;
  label: string;
  icon: any;
  badge?: string;
  isExternal?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export const AppSidebar: React.FC<{
  isOpen?: boolean;
  onClose?: () => void;
  onOpenDocs?: () => void;
}> = ({
  isOpen = false,
  onClose,
}) => {
  const pathname = usePathname();
  const { user, accountId, isConnected, isAdmin, signOut, openAuthModal } = useWallet();
  const [searchTerm, setSearchTerm] = useState("");
  const [contractId, setContractId] = useState("");

  useEffect(() => {
    setContractId(tryGetPolicyContractId() || "guard2.sergeo-guard.testnet");
  }, []);

  const operationItems: NavItem[] = [
    {
      href: "/",
      label: "Overview",
      icon: Layers,
    },
    {
      href: "/#arena",
      label: "Attack Arena",
      icon: Terminal,
      badge: "Live",
    },
    {
      href: "/dashboard",
      label: "Security Console",
      icon: LayoutDashboard,
      badge: "Active",
    },
    {
      href: "/create",
      label: "Issue Passkey",
      icon: PlusCircle,
      badge: "New",
    },
  ];

  if (isAdmin) {
    operationItems.push({
      href: "/admin",
      label: "Platform Admin",
      icon: Sliders,
      badge: "Cockpit",
    });
  }

  const navGroups: NavGroup[] = [
    {
      label: "Operations",
      items: operationItems,
    },
    {
      label: "Contracts",
      items: [
        {
          href: contractId ? `https://testnet.nearblocks.io/address/${contractId}` : "#",
          label: "ScopeGuard Contract",
          icon: Shield,
          isExternal: Boolean(contractId),
          badge: contractId ? "Active" : "Unconfigured",
        },
        {
          href: "https://testnet.meteorwallet.app",
          label: "Testnet Faucet",
          icon: Coins,
          isExternal: true,
          badge: "Free NEAR",
        },
        {
          href: "https://testnet.nearblocks.io/address/sergeo-guard-token.testnet",
          label: "mUSD Token",
          icon: Coins,
          isExternal: true,
          badge: "NEP-141",
        },
        {
          href: "https://testnet.nearblocks.io/address/sergeo-guard-dex.testnet",
          label: "Demo DEX",
          icon: Activity,
          isExternal: true,
          badge: "Swap",
        },
      ],
    },
    {
      label: "Community",
      items: [
        {
          href: "https://github.com/Sergeo01/Scopeguard",
          label: "GitHub Repository",
          icon: Github,
          isExternal: true,
          badge: "Source",
        },
        {
          href: "https://x.com/scopeguard",
          label: "X (Twitter)",
          icon: Twitter,
          isExternal: true,
        },
      ],
    },
  ];

  const content = (
    <aside className="w-64 h-full bg-white dark:bg-obsidian-950 border-r border-slate-200 dark:border-obsidian-800 flex flex-col justify-between shrink-0 select-none transition-colors">
      {/* Top Header */}
      <div className="p-5 space-y-4">
        {/* Brand */}
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group" onClick={onClose}>
            <ScopeGuardLogo className="w-7 h-7 transition-transform group-hover:scale-105 shrink-0" size={28} />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold tracking-tight leading-none text-slate-900 dark:text-white">
                  Scope<span className="text-brand-blue">Guard</span>
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-obsidian-900 text-slate-500 border border-slate-200 dark:border-obsidian-800">
                  NEAR
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                Scoped Agent Passkeys
              </p>
            </div>
          </Link>
        </div>

        {/* Quick Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search console..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-obsidian-800 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-brand-blue"
          />
        </div>

        {/* Navigation Groups */}
        <div className="space-y-4 pt-1">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 px-2 block">
                {group.label}
              </span>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = !item.isExternal && pathname === item.href;
                  const Icon = item.icon;

                  if (item.isExternal) {
                    return (
                      <a
                        key={item.label}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-obsidian-850 transition"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.label}</span>
                        </div>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    );
                  }

                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                        isActive
                          ? "bg-brand-blue/10 text-brand-blue font-semibold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-obsidian-850"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-3.5 h-3.5 ${isActive ? "text-brand-blue" : "text-slate-400"}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-obsidian-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-obsidian-800">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Pinned User Card & Theme Switcher */}
      <div className="p-4 border-t border-slate-200 dark:border-obsidian-800 space-y-3">
        {/* Direct Docs Link (Semantic Next.js Link) */}
        <Link
          href="/docs"
          onClick={onClose}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-obsidian-900 hover:bg-slate-100 dark:hover:bg-obsidian-850 border border-slate-200 dark:border-obsidian-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition group"
          title="Open ScopeGuard documentation, rule codes, and integration guides"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-brand-blue" />
            <span>Docs & Guides</span>
          </div>
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </Link>

        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            Theme
          </span>
          <ThemeToggle />
        </div>

        {/* Profile Card */}
        {user ? (
          <div className="p-2.5 rounded-lg border border-slate-200 dark:border-obsidian-800 bg-slate-50 dark:bg-obsidian-900 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-brand-blue text-white text-xs font-bold flex items-center justify-center shrink-0">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-slate-900 dark:text-white truncate block">
                  {user.displayName}
                </span>
                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                  {accountId || "no wallet"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={signOut}
              className="p-1 text-slate-400 hover:text-rose-500 transition rounded"
              title="Sign out of ScopeGuard"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={openAuthModal}
            className="w-full py-2 rounded-lg border border-slate-200 dark:border-obsidian-800 bg-white dark:bg-obsidian-900 hover:bg-slate-50 dark:hover:bg-obsidian-850 text-brand-blue text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Sign in to ScopeGuard</span>
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:block shrink-0">{content}</div>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="lg:hidden fixed inset-0 z-50 flex bg-black/60"
          onClick={(e) => {
            if (e.target === e.currentTarget && onClose) onClose();
          }}
        >
          <div className="w-64 h-full">{content}</div>
        </div>
      )}
    </>
  );
};
