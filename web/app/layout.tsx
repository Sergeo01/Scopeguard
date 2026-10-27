import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "ScopeGuard | Smart Spending Keys for Autonomous AI Agents",
  description:
    "Give your AI agent a spending card that can only do its job. Onchain security enforced by NEAR Protocol access keys and deterministic policy verification.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-slate-50">
      <body className="bg-slate-50 text-slate-900 min-h-screen flex flex-col font-sans antialiased selection:bg-slate-200 selection:text-slate-900">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">ScopeGuard</span>
              <span className="text-slate-400">·</span>
              <span>NEAR Hackathon: Build Beyond Boundaries</span>
            </div>
            <div className="flex items-center gap-4 text-slate-500 text-xs">
              <span>Primary Track: AI Security & Defense</span>
              <span className="text-slate-400">·</span>
              <span>Secondary Track: Agent Economy</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}