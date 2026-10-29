import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { WalletProvider } from "@/context/WalletContext";

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
    <html lang="en" className="bg-slate-50">
      <body className="bg-slate-50 text-slate-900 min-h-screen flex flex-col font-sans antialiased selection:bg-slate-200 selection:text-slate-900">
        <WalletProvider>
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
        </WalletProvider>
      </body>
    </html>
  );
}