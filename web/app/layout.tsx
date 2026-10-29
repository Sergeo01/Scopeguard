import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { WalletProvider } from "@/context/WalletContext";
import { ThemeProvider } from "@/context/ThemeContext";

export const metadata: Metadata = {
  title: "ScopeGuard | Scoped Spending Passkeys for AI Agents on NEAR",
  description:
    "Give your AI agent a key that can only do its job. Onchain policy enforcement and scoped passkeys on NEAR Protocol.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark bg-slate-50 dark:bg-obsidian-950">
      <body className="bg-slate-50 dark:bg-obsidian-950 text-slate-900 dark:text-slate-100 min-h-screen flex flex-col font-sans antialiased selection:bg-emerald-500/20 selection:text-emerald-400">
        <ThemeProvider>
          <WalletProvider>
            <Navbar />
            <main className="flex-1 w-full">{children}</main>
            <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-obsidian-900/60 py-6 text-xs text-slate-500 dark:text-slate-400 transition-colors">
              <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">ScopeGuard</span>
                  <span className="text-slate-400 dark:text-slate-600">·</span>
                  <span>NEAR Hackathon: Build Beyond Boundaries</span>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4 text-slate-500 dark:text-slate-400 text-xs">
                  <span>Primary Track: AI Security & Defense</span>
                  <span className="text-slate-400 dark:text-slate-600">·</span>
                  <span>Secondary Track: Agent Economy</span>
                </div>
              </div>
            </footer>
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
