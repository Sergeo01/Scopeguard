/** @type {import('tailwindcss').Config} */
module.exports = {
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
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
