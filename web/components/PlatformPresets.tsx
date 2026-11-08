"use client";

import React from "react";
import { Plus, Check, Shield } from "lucide-react";

export interface PresetPlatform {
  id: string;
  name: string;
  contract: string;
  methods: string;
  description: string;
  category: "DEX" | "Token";
}

export const PRESET_PLATFORMS: PresetPlatform[] = [
  {
    id: "preset-sergeo-dex",
    name: "ScopeGuard Testnet DEX",
    contract: "sergeo-guard-dex.testnet",
    methods: "swap",
    description: "Verified NEAR testnet automated market maker exchange",
    category: "DEX",
  },
  {
    id: "preset-sergeo-token",
    name: "ScopeGuard Custody Token",
    contract: "sergeo-guard-token.testnet",
    methods: "ft_transfer",
    description: "Verified NEAR testnet NEP-141 token custody contract",
    category: "Token",
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
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Verified Testnet Presets
        </label>
        <span className="text-[10px] text-slate-400">Click to arm or disarm</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PRESET_PLATFORMS.map((preset) => {
          const isSelected = activeContracts.some((c) => c.toLowerCase() === preset.contract.toLowerCase());
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onTogglePreset(preset)}
              className={`p-3 rounded-xl border text-left transition flex items-start justify-between gap-3 ${
                isSelected
                  ? "bg-blue-50/80 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 ring-1 ring-blue-500/20"
                  : "bg-white dark:bg-obsidian-900 border-slate-200 dark:border-obsidian-800 hover:border-slate-300 dark:hover:border-obsidian-700"
              }`}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {preset.name}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-slate-100 dark:bg-obsidian-800 text-slate-600 dark:text-slate-400">
                    {preset.category}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                  {preset.description}
                </p>
                <div className="flex items-center gap-2 pt-0.5 text-[10px] font-mono text-slate-400">
                  <span className="truncate max-w-[140px]">{preset.contract}</span>
                  <span>•</span>
                  <span>{preset.methods}</span>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 transition ${
                  isSelected
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-obsidian-800 text-slate-400 group-hover:text-slate-600"
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
