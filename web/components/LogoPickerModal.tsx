"use client";

import React from "react";
import { Check, X, Sparkles, Shield, Palette } from "lucide-react";
import { useLogo, LogoVariant } from "@/context/LogoContext";
import { ScopeGuardLogo } from "@/components/ScopeGuardLogo";

export const LOGO_OPTIONS: {
  id: LogoVariant;
  name: string;
  badge: string;
  description: string;
}[] = [
  {
    id: 1,
    name: "Precision Aperture Shield",
    badge: "Recommended",
    description: "Hexagonal security perimeter enclosing an optical reticle target and emerald nexus. High precision fintech aesthetic.",
  },
  {
    id: 2,
    name: "Isometric Nexus Prism",
    badge: "Abstract 3D",
    description: "Dual isometric facets (Owner + Agent) locking into an encrypted central core. Architectural and modern Web3.",
  },
  {
    id: 3,
    name: "Scoped S-Monogram",
    badge: "Brand Identity",
    description: "Cybernetic 'S' monogram bounded by four optical camera brackets. Clean and instantly recognizable at small icon sizes.",
  },
  {
    id: 4,
    name: "Sentinel Orbital Shield",
    badge: "Dynamic Radar",
    description: "Concentric radar arcs creating a rotating perimeter around a secured key beacon. Active telemetry aesthetic.",
  },
  {
    id: 5,
    name: "Bounded Infinity Rails",
    badge: "Mathematical",
    description: "Continuous infinity loop contained within rigid bounding rails, symbolizing autonomous automation bounded by hard onchain rules.",
  },
];

export const LogoPickerModal: React.FC = () => {
  const { variant, setVariant, showSelector, setShowSelector } = useLogo();

  if (!showSelector) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) setShowSelector(false);
      }}
    >
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-obsidian-900 p-6 sm:p-8 shadow-2xl space-y-6 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Choose ScopeGuard Brand Logo
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                5 custom architectural and abstract logo concepts. Click any to set active.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSelector(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 5 Logo Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[60vh] overflow-y-auto pr-1">
          {LOGO_OPTIONS.map((opt) => {
            const isSelected = variant === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setVariant(opt.id)}
                className={`p-4 rounded-2xl border text-left transition flex items-start gap-3.5 ${
                  isSelected
                    ? "bg-blue-50/60 dark:bg-obsidian-850 border-blue-500 ring-2 ring-blue-500/20 shadow-xs"
                    : "bg-white dark:bg-obsidian-950 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-obsidian-850"
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-slate-950 flex items-center justify-center shrink-0 border border-slate-800 shadow-sm">
                  <ScopeGuardLogo variantOverride={opt.id} size={32} />
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {opt.name}
                    </span>
                    {isSelected ? (
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-obsidian-800 text-slate-500">
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                    {opt.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Active: <strong>Option {variant}</strong> ({LOGO_OPTIONS.find((o) => o.id === variant)?.name})
          </span>
          <button
            type="button"
            onClick={() => setShowSelector(false)}
            className="px-4 py-2 rounded-full bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
