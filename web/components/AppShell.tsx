"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { TopStatusBar } from "@/components/TopStatusBar";
import { LogoPickerModal } from "@/components/LogoPickerModal";

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-dot-matrix">
      {/* Fixed Left Sidebar */}
      <AppSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Fluid Main Body */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Status Bar */}
        <TopStatusBar onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        {/* Scrollable Viewport Content */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 w-full">
          {children}
        </main>
      </div>

      {/* Global Logo Picker Modal */}
      <LogoPickerModal />
    </div>
  );
};
