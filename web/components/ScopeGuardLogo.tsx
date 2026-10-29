"use client";

import React from "react";
import { useLogo, LogoVariant } from "@/context/LogoContext";

interface LogoProps {
  className?: string;
  size?: number;
  variantOverride?: LogoVariant;
}

export const ScopeGuardLogo: React.FC<LogoProps> = ({
  className = "w-8 h-8",
  size = 32,
  variantOverride,
}) => {
  const { variant: contextVariant } = useLogo();
  const v = variantOverride !== undefined ? variantOverride : contextVariant;

  // Variant 1: Precision Aperture Shield
  if (v === 1) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="ScopeGuard Logo: Precision Aperture Shield"
      >
        <defs>
          <linearGradient id="sg1-shield" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0B0F19" />
            <stop offset="100%" stopColor="#1E1B4B" />
          </linearGradient>
          <linearGradient id="sg1-accent" x1="12" y1="12" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
        </defs>
        <path
          d="M24 3.5L41.5 11.5V23.5C41.5 33.5 34 41.5 24 44.5C14 41.5 6.5 33.5 6.5 23.5V11.5L24 3.5Z"
          fill="url(#sg1-shield)"
          stroke="#334155"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle cx="24" cy="24" r="10.5" stroke="url(#sg1-accent)" strokeWidth="2" strokeDasharray="13 4" />
        <line x1="24" y1="10" x2="24" y2="15" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
        <line x1="24" y1="33" x2="24" y2="38" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
        <line x1="10" y1="24" x2="15" y2="24" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
        <line x1="33" y1="24" x2="38" y2="24" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="24" r="3" fill="#10B981" />
      </svg>
    );
  }

  // Variant 2: Isometric Nexus Prism (Abstract 3D Shield)
  if (v === 2) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="ScopeGuard Logo: Isometric Nexus Prism"
      >
        <defs>
          <linearGradient id="sg2-left" x1="8" y1="12" x2="24" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E1B4B" />
            <stop offset="100%" stopColor="#0B0F19" />
          </linearGradient>
          <linearGradient id="sg2-right" x1="24" y1="12" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          <linearGradient id="sg2-top" x1="12" y1="6" x2="36" y2="18" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        {/* Top facet */}
        <path d="M24 6L38 14L24 22L10 14L24 6Z" fill="url(#sg2-top)" />
        {/* Left facet */}
        <path d="M10 14L24 22V42L10 34V14Z" fill="url(#sg2-left)" stroke="#334155" strokeWidth="1" />
        {/* Right facet */}
        <path d="M24 22L38 14V34L24 42V22Z" fill="url(#sg2-right)" stroke="#1E40AF" strokeWidth="1" />
        {/* Core Nexus Ring */}
        <circle cx="24" cy="22" r="4.5" fill="#0B0F19" stroke="#10B981" strokeWidth="1.5" />
        <circle cx="24" cy="22" r="1.5" fill="#10B981" />
      </svg>
    );
  }

  // Variant 3: Scoped S-Monogram
  if (v === 3) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="ScopeGuard Logo: Scoped S-Monogram"
      >
        <defs>
          <linearGradient id="sg3-bg" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0B0F19" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>
          <linearGradient id="sg3-s" x1="12" y1="12" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="50%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="40" height="40" rx="12" fill="url(#sg3-bg)" stroke="#334155" strokeWidth="1.5" />
        {/* Precision Target Brackets */}
        <path d="M11 17H8V11H14" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M37 17H40V11H34" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M11 31H8V37H14" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M37 31H40V37H34" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
        {/* Flowing 'S' Ribbon */}
        <path
          d="M32 16H20C16.5 16 14 18.5 14 22C14 25.5 17 27.5 21 28.5L27 30C31 31 34 32.5 34 36.5C34 40 31.5 42 27 42H16"
          stroke="url(#sg3-s)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="24" cy="24" r="2" fill="#10B981" />
      </svg>
    );
  }

  // Variant 4: Sentinel Orbital Ring (Abstract Concentric Radar)
  if (v === 4) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="ScopeGuard Logo: Sentinel Orbital Ring"
      >
        <defs>
          <linearGradient id="sg4-grad" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="20" stroke="#1E293B" strokeWidth="2" />
        {/* Outer segmented radar arc */}
        <path
          d="M24 6C33.94 6 42 14.06 42 24"
          stroke="url(#sg4-grad)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Middle reverse arc */}
        <path
          d="M24 40C15.16 40 8 32.84 8 24"
          stroke="#10B981"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Inner Target Ring */}
        <circle cx="24" cy="24" r="7" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="4 2" />
        <circle cx="24" cy="24" r="3" fill="#10B981" />
        <line x1="24" y1="13" x2="24" y2="17" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // Variant 5: Bounded Infinity Rails (Safe Dual-Loop)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="ScopeGuard Logo: Bounded Infinity Rails"
    >
      <defs>
        <linearGradient id="sg5-loop" x1="8" y1="16" x2="40" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="50%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
      </defs>
      {/* Outer bounding security rail box */}
      <rect x="6" y="10" width="36" height="28" rx="8" stroke="#334155" strokeWidth="1.5" strokeDasharray="18 4" />
      {/* Continuous Infinity Loop */}
      <path
        d="M17 18C13.68 18 11 20.68 11 24C11 27.32 13.68 30 17 30C21.4 30 24 24 24 24C24 24 26.6 18 31 18C34.32 18 37 20.68 37 24C37 27.32 34.32 30 31 30C26.6 30 24 24 24 24"
        stroke="url(#sg5-loop)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17" cy="24" r="2" fill="#10B981" />
      <circle cx="31" cy="24" r="2" fill="#2563EB" />
    </svg>
  );
};
