"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
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
} from "lucide-react";
import { ScopeGuardLogo } from "@/components/ScopeGuardLogo";
import { useWallet } from "@/context/WalletContext";
import { useLogo } from "@/context/LogoContext";
import { ThemeToggle } from "@/components/ThemeToggle";

interface NavItem {
  href: string;
  label: string;
  icon: any;
  badge?: string;
  badgeColor?: string;
  isExternal?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export const AppSidebar: React.FC<{ isOpen?: boolean; onClose?: () => void }> = ({
  isOpen = false,
  onClose,
}) => {
  const pathname = usePathname();
  const { accountId, isConnected, disconnectWallet } = useWallet();
  const { setShowSelector } = useLogo();
  const [searchTerm, setSearchTerm] = useState("");

  const navGroups: NavGroup[] = [
    {
      label: "OPERATIONS",
      items: [
        {
          href: "/",
          label: "Attack Simulator",
          icon: Sparkles,
          badge: "Live",
          badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
        },
        {
          href: "/dashboard",
          label: "Security Console",
          icon: LayoutDashboard,
          badge: "7 Rules",
          badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
        },
        {
          href: "/create",
          label: "Issue Passkey",
          icon: PlusCircle,
          badge: "New",
          badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
        },
      ],
    },
    {
      label: "ONCHAIN CONTRACTS",
      items: [
        {
          href: "https://testnet.nearblocks.io/address/guard2.sergeo-guard.testnet",
          label: "Guard Contract",
          icon: Shield,
          isExternal: true,
          badge: "v0.1.0",
          badgeColor: "bg-slate-100 dark:bg-obsidian-800 text-slate-500",
        },
        {
          href: "https://testnet.nearblocks.io/address/sergeo-guard-token.testnet",
          label: "mUSD Token",
          icon: Coins,
          isExternal: true,
          badge: "NEP-141",
          badgeColor: "bg-slate-100 dark:bg-obsidian-800 text-slate-500",
        },
        {
          href: "https://testnet.nearblocks.io/address/sergeo-guard-dex.testnet",
          label: "Demo DEX",
          icon: Activity,
          isExternal: true,
          badge: "Swap",
          badgeColor: "bg-slate-100 dark:bg-obsidian-800 text-slate-500",
        },
      ],
    },
  ];

  const content = (
    <aside className="w-64 h-full bg-white dark:bg-obsidian-950 border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between shrink-0 select-none shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-colors">
      {/* Top Header */}
      <div className="p-5 space-y-4">
        {/* Brand */}
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group" onClick={onClose}>
            <ScopeGuardLogo className="w-8 h-8 transition-transform group-hover:scale-105" size={32} />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  ScopeGuard
                </span>
                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-obsidian-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  NEAR
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                Scoped Agent Passkeys
              </p>
            </div>
          </Link>

          {/* Logo Picker trigger */}
          <button
            type="button"
            onClick={() => setShowSelector(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-obsidian-850 transition"
            title="Choose custom logo variant (5 concepts)"
          >
            <Palette className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick Search with ⌘K */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-10 py-1.5 bg-slate-50 dark:bg-obsidian-900 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-obsidian-800 text-slate-500">
            ⌘K
          </span>
        </div>

        {/* Navigation Groups */}
        <div className="space-y-5 pt-2">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2.5 block">
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
                        className="flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-obsidian-850 transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4 text-slate-400" />
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
                      className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition ${
                        isActive
                          ? "bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-obsidian-850"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${item.badgeColor}`}>
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
      <div className="p-4 border-t border-slate-200/80 dark:border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
            THEME & NETWORK
          </span>
          <ThemeToggle />
        </div>

        {/* Profile Card */}
        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-obsidian-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-500 to-blue-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
              {accountId ? accountId.charAt(0).toUpperCase() : "S"}
            </div>
            <div className="min-w-0">
              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white block truncate">
                {accountId || "sergeo-guard.testnet"}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Verified Owner
              </span>
            </div>
          </div>

          {isConnected && (
            <button
              type="button"
              onClick={disconnectWallet}
              className="p-1 text-slate-400 hover:text-rose-600 transition"
              title="Disconnect Wallet"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <div className="hidden lg:block shrink-0">{content}</div>

      {/* Mobile Drawer */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="lg:hidden fixed inset-0 z-50 flex bg-slate-950/60 backdrop-blur-xs"
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
