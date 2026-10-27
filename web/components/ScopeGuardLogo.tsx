import React from "react";

interface LogoProps {
  className?: string;
  size?: number;
}

export const ScopeGuardLogo: React.FC<LogoProps> = ({ className = "w-8 h-8", size = 32 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="ScopeGuard Logo"
    >
      <defs>
        {/* Exterior Shield Gradient */}
        <linearGradient id="sg-shield-grad" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#1E293B" />
        </linearGradient>

        {/* Reticle / Scope Emerald Accent */}
        <linearGradient id="sg-reticle-grad" x1="12" y1="12" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>

        {/* Glow Filter */}
        <filter id="sg-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Hexagonal Shield Body */}
      <path
        d="M24 3.5L41.5 11.5V23.5C41.5 33.5 34 41.5 24 44.5C14 41.5 6.5 33.5 6.5 23.5V11.5L24 3.5Z"
        fill="url(#sg-shield-grad)"
        stroke="#334155"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Inner Precision Scope Ring (3/4 Circle with Target Breaks) */}
      <circle
        cx="24"
        cy="24"
        r="11"
        stroke="url(#sg-reticle-grad)"
        strokeWidth="2"
        strokeDasharray="14 3.5"
        strokeLinecap="round"
      />

      {/* Reticle Crosshairs (Top, Bottom, Left, Right ticks) */}
      <line x1="24" y1="9" x2="24" y2="13" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="35" x2="24" y2="39" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
      <line x1="9" y1="24" x2="13" y2="24" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
      <line x1="35" y1="24" x2="39" y2="24" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />

      {/* Central Keyhole & Bounded Passkey Core */}
      <circle cx="24" cy="22" r="3.2" fill="#FFFFFF" />
      <path
        d="M22 23L21.2 30H26.8L26 23H22Z"
        fill="#FFFFFF"
      />
      <circle cx="24" cy="22" r="1.3" fill="#0F172A" />

      {/* Security Check Indicator Dot */}
      <circle cx="34" cy="14" r="2.2" fill="#10B981" filter="url(#sg-glow)" />
    </svg>
  );
};
