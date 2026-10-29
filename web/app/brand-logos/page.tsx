"use client";

import React from "react";
import { ScopeGuardLogo } from "@/components/ScopeGuardLogo";

export default function BrandLogosPage() {
  const logos = [
    {
      id: 1,
      name: "Option 1: Precision Aperture Shield",
      tagline: "Cybernetic Defense & Targeting",
      description:
        "A hardened cryptographic shield enclosing an optical camera crosshair reticle and a glowing emerald central vault nexus. Represents precise parameter targeting and impenetrable protection.",
      accent: "from-blue-600 to-emerald-500",
      accentBorder: "border-blue-500/30",
    },
    {
      id: 2,
      name: "Option 2: Isometric Nexus Prism",
      tagline: "Abstract 3D Dimension",
      description:
        "The Human Owner plane and Autonomous Agent plane interlock in clean isometric 3D space around an encrypted emerald vault core. Symbolizes cooperative multi-agent security.",
      accent: "from-emerald-500 to-blue-600",
      accentBorder: "border-emerald-500/30",
    },
    {
      id: 3,
      name: "Option 3: Scoped S-Monogram",
      tagline: "Minimalist Fintech & Precision",
      description:
        "A cybernetic fluid 'S' ribbon framed tightly inside optical viewfinder brackets. Inspired by the clean, high-craft aesthetics of Linear and Stripe.",
      accent: "from-indigo-500 to-cyan-500",
      accentBorder: "border-indigo-500/30",
    },
    {
      id: 4,
      name: "Option 4: Sentinel Orbital Ring",
      tagline: "Live Security Telemetry",
      description:
        "Concentric telemetry radar arcs with an active 45-degree emerald ping. Represents real-time onchain velocity monitoring, speed throttles, and circuit breakers.",
      accent: "from-sky-500 to-emerald-500",
      accentBorder: "border-sky-500/30",
    },
    {
      id: 5,
      name: "Option 5: Bounded Infinity Rails",
      tagline: "Mathematical Safety Limits",
      description:
        "A continuous autonomous agent loop (infinity) bounded strictly between rigid onchain spending cap rails. The agent operates freely, but cannot escape the bounds.",
      accent: "from-emerald-400 to-blue-500",
      accentBorder: "border-emerald-400/30",
    },
  ];

  return (
    <div className="min-h-screen bg-[#080B11] text-white p-8 sm:p-12 font-sans antialiased">
      {/* Header Banner */}
      <div className="max-w-6xl mx-auto text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4">
          ScopeGuard Identity Suite
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-3">
          Select Your Official Brand Logo
        </h1>
        <p className="text-slate-400 text-base max-w-2xl mx-auto">
          Here are the 5 custom logo designs rendered in high resolution. Review how each looks on dark obsidian glassmorphism and crisp pure-white surfaces.
        </p>
      </div>

      {/* 5-Column Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {logos.map((logo) => (
          <div
            key={logo.id}
            id={`logo-card-${logo.id}`}
            className="flex flex-col bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 relative overflow-hidden shadow-2xl hover:border-blue-500/40 transition-all"
          >
            {/* Number Badge */}
            <div className="flex items-center justify-between mb-4">
              <span className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-mono font-bold text-sm flex items-center justify-center">
                #{logo.id}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Vector 4K
              </span>
            </div>

            {/* Dark Hero Display */}
            <div className="w-full aspect-square rounded-2xl bg-gradient-to-b from-white/[0.05] to-transparent border border-white/10 flex items-center justify-center p-6 mb-5 shadow-inner">
              <ScopeGuardLogo variantOverride={logo.id as any} size={96} className="w-24 h-24 drop-shadow-[0_0_24px_rgba(37,99,235,0.35)]" />
            </div>

            {/* Meta */}
            <h3 className="text-base font-bold text-white mb-1 tracking-tight">
              {logo.name}
            </h3>
            <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-2">
              {logo.tagline}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-5 flex-1">
              {logo.description}
            </p>

            {/* Light Mode Preview */}
            <div className="mt-auto pt-4 border-t border-white/10">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Light Surface Preview
              </div>
              <div className="bg-white rounded-xl p-3 flex items-center gap-3 border border-slate-200 shadow-sm">
                <ScopeGuardLogo variantOverride={logo.id as any} size={28} className="w-7 h-7 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-black text-slate-900 tracking-tight leading-none">
                    ScopeGuard
                  </div>
                  <div className="text-[9px] font-medium text-slate-500 leading-none mt-0.5">
                    NEAR Protocol
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
