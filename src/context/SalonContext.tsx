import React, { createContext, useContext, useState, useEffect } from 'react';

interface SalonContextType {
  activeSalonId: string | null;
  activeBranchId: string | null;
  setActiveSalonId: (id: string | null) => void;
  setActiveBranchId: (id: string | null) => void;
  hasSalonContext: boolean;
}

const SalonContext = createContext<SalonContextType | undefined>(undefined);

export const SalonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSalonId, setActiveSalonId] = useState<string | null>(() => {
    return localStorage.getItem('activeSalonId');
  });
  const [activeBranchId, setActiveBranchId] = useState<string | null>(() => {
    return localStorage.getItem('activeBranchId');
  });

  useEffect(() => {
    if (activeSalonId) {
      localStorage.setItem('activeSalonId', activeSalonId);
    } else {
      localStorage.removeItem('activeSalonId');
    }
  }, [activeSalonId]);

  useEffect(() => {
    if (activeBranchId) {
      localStorage.setItem('activeBranchId', activeBranchId);
    } else {
      localStorage.removeItem('activeBranchId');
    }
  }, [activeBranchId]);

  return (
    <SalonContext.Provider
      value={{
        activeSalonId,
        activeBranchId,
        setActiveSalonId,
        setActiveBranchId,
        hasSalonContext: !!(activeSalonId && activeBranchId),
      }}
    >
      {children}
    </SalonContext.Provider>
  );
};

export const useSalon = () => {
  const context = useContext(SalonContext);
  if (!context) {
    throw new Error('useSalon must be used within a SalonProvider');
  }
  return context;
};
