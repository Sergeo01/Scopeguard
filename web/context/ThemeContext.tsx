"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let initialTheme: Theme = "dark";
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const queryTheme = params.get("theme");
      if (queryTheme === "light" || queryTheme === "dark") {
        initialTheme = queryTheme;
        localStorage.setItem("scopeguard_theme", queryTheme);
      } else {
        const saved = localStorage.getItem("scopeguard_theme") as Theme | null;
        if (saved === "light" || saved === "dark") {
          initialTheme = saved;
        }
      }
    }
    setThemeState(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const applyTheme = (t: Theme) => {
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    localStorage.setItem("scopeguard_theme", t);
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
