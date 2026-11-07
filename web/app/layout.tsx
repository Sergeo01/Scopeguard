import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/context/WalletContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { LogoProvider } from "@/context/LogoContext";
import { DocsProvider } from "@/context/DocsContext";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "ScopeGuard | Onchain Guardrails for Autonomous Capital",
  description:
    "Give your agents a budget, not your private keys. Onchain guardrails and policy enforcement for autonomous capital on NEAR Protocol.",
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
    <html lang="en" suppressHydrationWarning className="dark bg-[#F8F9FA] dark:bg-obsidian-950">
      <body suppressHydrationWarning className="bg-[#F8F9FA] dark:bg-obsidian-950 text-slate-900 dark:text-slate-100 min-h-screen font-sans antialiased selection:bg-blue-600/20 selection:text-blue-600">
        <ThemeProvider>
          <WalletProvider>
            <LogoProvider>
              <DocsProvider>
                <AppShell>{children}</AppShell>
              </DocsProvider>
            </LogoProvider>
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
