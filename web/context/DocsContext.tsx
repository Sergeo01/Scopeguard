"use client";

import React, { createContext, useContext, useState } from "react";
import { DocsModal } from "@/components/DocsModal";

interface DocsContextType {
  isDocsOpen: boolean;
  openDocs: () => void;
  closeDocs: () => void;
}

const DocsContext = createContext<DocsContextType>({
  isDocsOpen: false,
  openDocs: () => {},
  closeDocs: () => {},
});

export const DocsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDocsOpen, setIsDocsOpen] = useState(false);

  return (
    <DocsContext.Provider
      value={{
        isDocsOpen,
        openDocs: () => setIsDocsOpen(true),
        closeDocs: () => setIsDocsOpen(false),
      }}
    >
      {children}
      <DocsModal isOpen={isDocsOpen} onClose={() => setIsDocsOpen(false)} />
    </DocsContext.Provider>
  );
};

export const useDocs = () => useContext(DocsContext);
