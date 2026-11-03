"use client";

import React from "react";
import { AlertOctagon, ShieldAlert, Play, CheckCircle2 } from "lucide-react";

export interface RejectionEvent {
  timestamp: number;
  reason: string;
  target?: string;
  method?: string;
}

export interface CircuitBreakerBannerProps {
  isPaused: boolean;
  rejectCount: number;
  maxRejects: number;
  windowMinutes: number;
  recentRejections: RejectionEvent[];
  onUnpause: () => Promise<void>;
  isOwner: boolean;
}

export const CircuitBreakerBanner: React.FC<CircuitBreakerBannerProps> = ({
  isPaused,
  rejectCount,
  maxRejects,
  windowMinutes,
  recentRejections,
  onUnpause,
  isOwner,
}) => {
  if (!isPaused && rejectCount === 0) {
    return null;
  }

  const isTripped = isPaused && rejectCount >= maxRejects;

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        isTripped
          ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
          : isPaused
          ? "border-slate-300 dark:border-obsidian-800 bg-slate-100 dark:bg-obsidian-900 text-slate-800 dark:text-slate-200"
          : "border-slate-200 dark:border-obsidian-800 bg-white dark:bg-obsidian-900 text-slate-700 dark:text-slate-300"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                isTripped
                  ? "bg-rose-500 animate-pulse"
                  : isPaused
                  ? "bg-slate-400"
                  : "bg-mint-green"
              }`}
            />
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              {isTripped
                ? "Emergency Circuit Breaker Tripped"
                : isPaused
                ? "Agent Execution Paused by Owner"
                : `Reject Counter: ${rejectCount} / ${maxRejects}`}
            </h4>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
            {isTripped
              ? `The Guard intercepted ${rejectCount} policy violations within ${windowMinutes} minutes. The automated circuit breaker halted all agent actions onchain to prevent fund loss.`
              : isPaused
              ? "All contract actions are currently paused at the protocol guard level until owner review."
              : `Normal operating state. Auto-pauses if ${maxRejects} rejections occur within a ${windowMinutes}-minute rolling window.`}
          </p>
        </div>

        {isPaused && isOwner && (
          <button
            onClick={onUnpause}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-brand-blue hover:bg-brand-blueHover text-white transition"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Unpause & Resume</span>
          </button>
        )}
      </div>
    </div>
  );
};
