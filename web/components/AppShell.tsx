"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { TopStatusBar } from "@/components/TopStatusBar";
import { LogoPickerModal } from "@/components/LogoPickerModal";
import { DocsModal } from "@/components/DocsModal";

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-dot-matrix">
      {/* Fixed Left Sidebar */}
      <AppSidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onOpenDocs={() => setShowDocsModal(true)}
      />

      {/* Fluid Main Body */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Status Bar */}
        <TopStatusBar
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenDocs={() => setShowDocsModal(true)}
        />

        {/* Scrollable Viewport Content */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 w-full">
          {children}
        </main>
      </div>

      {/* Global Logo Picker Modal */}
      <LogoPickerModal />

      {/* Interactive Docs & Guide Modal */}
      <DocsModal isOpen={showDocsModal} onClose={() => setShowDocsModal(false)} />
    </div>
  );
};
