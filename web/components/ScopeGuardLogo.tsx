"use client";

import React from "react";

interface LogoProps {
  className?: string;
  size?: number;
  sparkleColor?: string;
  withText?: boolean;
  textSize?: "sm" | "md" | "lg" | "xl";
}

export const ScopeGuardLogo: React.FC<LogoProps> = ({
  className = "w-8 h-8",
  size = 32,
  sparkleColor,
  withText = false,
  textSize = "lg",
}) => {
  const icon = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="ScopeGuard Official Hexagonal Security Logo"
    >
      <defs>
        {/* Subtle metallic sheen for the outer hexagonal arms */}
        <linearGradient id="sg-metallic" x1="12" y1="6" x2="88" y2="94" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor="#F1F5F9" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
        <linearGradient id="sg-metallic-dark" x1="12" y1="6" x2="88" y2="94" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#1E293B" />
        </linearGradient>
      </defs>

      {/* Top Arm of the Hexagonal S */}
      <path
        d="M 88 38 L 88 28 L 50 6 L 12 28 L 12 54 L 35 67 L 35 53 L 25 47 L 25 36 L 50 21 L 75 36 L 75 45 Z"
        className="fill-slate-900 dark:fill-white transition-colors"
      />

      {/* Center 4-Point Star (Sparkle) */}
      <path
        d="M 50 38 Q 50 50 38 50 Q 50 50 50 62 Q 50 50 62 50 Q 50 50 50 38 Z"
        fill={sparkleColor || undefined}
        className={sparkleColor ? "" : "fill-blue-600 dark:fill-white transition-colors"}
      />

      {/* Bottom Arm of the Hexagonal S (180-degree rotational symmetry) */}
      <path
        d="M 12 62 L 12 72 L 50 94 L 88 72 L 88 46 L 65 33 L 65 47 L 75 53 L 75 64 L 50 79 L 25 64 L 25 55 Z"
        className="fill-slate-900 dark:fill-white transition-colors"
      />
    </svg>
  );

  if (!withText) return icon;

  const textClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
    xl: "text-2xl",
  }[textSize];

  return (
    <div className="inline-flex items-center gap-2.5">
      {icon}
      <span className={`font-extrabold tracking-tight leading-none ${textClasses}`}>
        <span className="text-slate-900 dark:text-white">Scope</span>
        <span className="text-blue-600 dark:text-blue-500">Guard</span>
      </span>
    </div>
  );
};
