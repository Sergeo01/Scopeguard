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
      className={`rounded-2xl border p-5 transition-all shadow-sm ${
        isTripped
          ? "border-rose-300 bg-rose-50 text-rose-950"
          : isPaused
          ? "border-amber-300 bg-amber-50 text-amber-950"
          : "border-slate-200 bg-white text-slate-700"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                isTripped
                  ? "bg-rose-600 animate-pulse"
                  : isPaused
                  ? "bg-amber-600"
                  : "bg-emerald-600"
              }`}
            />
            <h4 className="text-sm font-bold text-slate-900">
              {isTripped
                ? "Emergency Circuit Breaker Tripped"
                : isPaused
                ? "Agent Execution Paused by Owner"
                : `Suspicious Reject Counter: ${rejectCount} / ${maxRejects}`}
            </h4>
          </div>
          <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
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
            className="inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition shadow-sm"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Unpause & Resume Operations</span>
          </button>
        )}
      </div>
    </div>
  );
};