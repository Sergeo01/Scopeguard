"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type LogoVariant = 1 | 2 | 3 | 4 | 5;

interface LogoContextType {
  variant: LogoVariant;
  setVariant: (v: LogoVariant) => void;
  showSelector: boolean;
  setShowSelector: (show: boolean) => void;
}

const LogoContext = createContext<LogoContextType | undefined>(undefined);

export const LogoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [variant, setVariantState] = useState<LogoVariant>(1);
  const [showSelector, setShowSelector] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("scopeguard_logo_variant");
      if (saved) {
        const num = Number(saved) as LogoVariant;
        if (num >= 1 && num <= 5) setVariantState(num);
      }
    }
  }, []);

  const setVariant = (v: LogoVariant) => {
    setVariantState(v);
    if (typeof window !== "undefined") {
      localStorage.setItem("scopeguard_logo_variant", String(v));
    }
  };

  return (
    <LogoContext.Provider value={{ variant, setVariant, showSelector, setShowSelector }}>
      {children}
    </LogoContext.Provider>
  );
};

export const useLogo = () => {
  const ctx = useContext(LogoContext);
  if (!ctx) {
    return {
      variant: 1 as LogoVariant,
      setVariant: () => {},
      showSelector: false,
      setShowSelector: () => {},
    };
  }
  return ctx;
};
