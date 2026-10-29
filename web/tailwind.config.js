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
        near: {
          green: "#00EC97",
          dark: "#0F172A",
          card: "#1E293B",
          border: "#334155",
        },
        obsidian: {
          950: "#060911",
          900: "#0b1120",
          850: "#10182c",
          800: "#162038",
          700: "#1e2c4c",
          600: "#2a3d68",
        },
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        glow: "0 0 25px -5px rgba(16, 185, 129, 0.25)",
        "glow-rose": "0 0 25px -5px rgba(244, 63, 94, 0.25)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
