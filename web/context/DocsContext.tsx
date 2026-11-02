"use client";

import React, { createContext, useContext } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  const handleOpenDocs = () => {
    if (typeof window !== "undefined") {
      router.push("/docs");
    }
  };

  return (
    <DocsContext.Provider
      value={{
        isDocsOpen: false,
        openDocs: handleOpenDocs,
        closeDocs: () => {},
      }}
    >
      {children}
    </DocsContext.Provider>
  );
};

export const useDocs = () => useContext(DocsContext);
