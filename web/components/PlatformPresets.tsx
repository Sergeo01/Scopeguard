"use client";

import React from "react";
import { Plus, Check, Shield } from "lucide-react";

export interface PresetPlatform {
  id: string;
  name: string;
  contract: string;
  methods: string;
  description: string;
  category: "DEX" | "Lending" | "Intents";
}

export const PRESET_PLATFORMS: PresetPlatform[] = [
  {
    id: "preset-sergeo-dex",
    name: "ScopeGuard Testnet DEX",
    contract: "sergeo-guard-dex.testnet",
    methods: "swap",
    description: "Verified Hackathon demo exchange for mUSD trading",
    category: "DEX",
  },
  {
    id: "preset-ref",
    name: "Ref Finance",
    contract: "ref-finance.near",
    methods: "swap, deposit",
    description: "Main NEAR decentralized automated market maker",
    category: "DEX",
  },
  {
    id: "preset-burrow",
    name: "Burrow Finance",
    contract: "contract.main.burrow.near",
    methods: "borrow, repay",
    description: "Decentralized money market and interest protocol",
    category: "Lending",
  },
  {
    id: "preset-intents",
    name: "NEAR Intents",
    contract: "intents.near",
    methods: "execute_intent",
    description: "Cross-chain automated solver and market routing",
    category: "Intents",
  },
];

interface PlatformPresetsProps {
  activeContracts: string[];
  onTogglePreset: (preset: PresetPlatform) => void;
}

export const PlatformPresets: React.FC<PlatformPresetsProps> = ({
  activeContracts,
  onTogglePreset,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-800 block">
          Quick-Add Pre-Vetted Platforms
        </label>
        <span className="text-[11px] text-slate-500">
          Click any preset to add or remove
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PRESET_PLATFORMS.map((preset) => {
          const isSelected = activeContracts.includes(preset.contract);
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onTogglePreset(preset)}
              className={`p-2.5 rounded-lg border text-left transition flex items-start justify-between gap-2 text-xs ${
                isSelected
                  ? "bg-emerald-50/70 border-emerald-300 text-slate-900"
                  : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-900 truncate">
                    {preset.name}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                      preset.category === "DEX"
                        ? "bg-blue-100 text-blue-800"
                        : preset.category === "Lending"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {preset.category}
                  </span>
                </div>
                <div className="font-mono text-[10px] text-slate-500 truncate">
                  {preset.contract}
                </div>
              </div>

              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                  isSelected
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "border-slate-300 bg-slate-50 text-slate-400"
                }`}
              >
                {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
