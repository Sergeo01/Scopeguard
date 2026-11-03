/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: "#08090D", // Canvas base
          900: "#0E1015", // Primary card surface
          850: "#14171E", // Secondary / elevated surface
          800: "#1C2029", // Structural 1px border
          700: "#282E3B", // Active / hover border
          600: "#3D4659", // Subtle divider
        },
        brand: {
          blue: "#2563EB",      // Primary Brand Cobalt Blue
          blueHover: "#1D4ED8", // Active hover blue
          blueLight: "#3B82F6", // Accessible link blue
        },
        mint: {
          green: "#00EC97",     // NEAR Functional Security Green
          greenDark: "#059669", // Dark mode accessible green text
          greenBg: "rgba(0, 236, 151, 0.08)",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["DM Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
      boxShadow: {
        subtle: "0 1px 3px 0 rgba(0, 0, 0, 0.04)",
        card: "0 2px 8px -2px rgba(0, 0, 0, 0.06)",
      },
    },
  },
  plugins: [],
};
