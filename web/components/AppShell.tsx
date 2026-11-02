"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/AppSidebar";
import { TopStatusBar } from "@/components/TopStatusBar";
import { AuthModal } from "@/components/AuthModal";
import { useDocs } from "@/context/DocsContext";

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { openDocs } = useDocs();

  // Route Separation:
  // "/" is the Public Marketing Landing Page
  // "/docs" is the Dedicated GitBook-Style Documentation Page
  const isLandingPage = pathname === "/";
  const isDocsPage = pathname?.startsWith("/docs");

  if (isLandingPage || isDocsPage) {
    return (
      <div className="min-h-screen w-full bg-white dark:bg-[#07090E] text-slate-900 dark:text-slate-100 flex flex-col selection:bg-blue-600/30 selection:text-blue-300">
        <main className="flex-1 w-full">
          {children}
        </main>
        <AuthModal />
      </div>
    );
  }

  // Dashboard, Create, Admin, and Operations Console routes
  return (
    <div className="flex h-screen w-full overflow-hidden bg-dot-matrix">
      {/* Fixed Left Sidebar */}
      <AppSidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onOpenDocs={openDocs}
      />

      {/* Fluid Main Body */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Status Bar */}
        <TopStatusBar
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenDocs={openDocs}
        />

        {/* Scrollable Viewport Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-8 py-6 w-full">
          {children}
        </main>
      </div>

      {/* Unified Authentication & Sub-accounts Modal */}
      <AuthModal />
    </div>
  );
};
