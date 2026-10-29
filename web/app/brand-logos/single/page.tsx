"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ScopeGuardLogo } from "@/components/ScopeGuardLogo";

function SingleLogoInner() {
  const searchParams = useSearchParams();
  const idStr = searchParams.get("id") || "1";
  const id = parseInt(idStr, 10) as any;

  const names: Record<number, { name: string; tag: string; desc: string }> = {
    1: {
      name: "Precision Aperture Shield",
      tag: "Cybernetic Defense",
      desc: "Segmented targeting reticle with emerald nexus core",
    },
    2: {
      name: "Isometric Nexus Prism",
      tag: "Abstract 3D Shield",
      desc: "Dual human/agent planes interlocking around vault core",
    },
    3: {
      name: "Scoped S-Monogram",
      tag: "Minimalist Fintech",
      desc: "Cybernetic S-ribbon bounded in viewfinder brackets",
    },
    4: {
      name: "Sentinel Orbital Ring",
      tag: "Security Telemetry",
      desc: "Radar sweep with live onchain telemetry ping",
    },
    5: {
      name: "Bounded Infinity Rails",
      tag: "Mathematical Safety",
      desc: "Agent execution infinity loop bounded by spending rails",
    },
  };

  const info = names[id] || names[1];

  return (
    <div className="w-[512px] h-[512px] bg-[#0B0F19] p-8 flex flex-col items-center justify-between font-sans relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.18)_0,transparent_70%)] pointer-events-none" />

      {/* Top Header */}
      <div className="w-full flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400 font-mono font-bold text-xs flex items-center justify-center">
            #{id}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
            {info.tag}
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
          ScopeGuard
        </span>
      </div>

      {/* Centerpiece Hero Logo */}
      <div className="w-48 h-48 rounded-3xl bg-gradient-to-b from-white/[0.06] to-transparent border border-white/10 flex items-center justify-center p-8 shadow-2xl z-10">
        <ScopeGuardLogo variantOverride={id} size={144} className="w-36 h-36 drop-shadow-[0_0_36px_rgba(37,99,235,0.45)]" />
      </div>

      {/* Bottom Info and Light Surface Preview */}
      <div className="w-full flex items-center justify-between gap-4 z-10 pt-4 border-t border-white/10">
        <div className="min-w-0">
          <div className="text-base font-bold text-white tracking-tight leading-tight">
            {info.name}
          </div>
          <div className="text-xs text-slate-400 truncate max-w-[260px] mt-0.5">
            {info.desc}
          </div>
        </div>

        {/* Crisp Light Mode Badge */}
        <div className="bg-white rounded-xl px-3.5 py-2 flex items-center gap-2 border border-slate-200 shadow-md flex-shrink-0">
          <ScopeGuardLogo variantOverride={id} size={22} className="w-5.5 h-5.5 flex-shrink-0" />
          <span className="text-xs font-black text-slate-900 tracking-tight">
            ScopeGuard
          </span>
        </div>
      </div>
    </div>
  );
}

export default function SingleLogoPage() {
  return (
    <Suspense fallback={<div className="text-white">Loading...</div>}>
      <SingleLogoInner />
    </Suspense>
  );
}
