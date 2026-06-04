import React, { createContext, useContext, useEffect, useState } from 'react';

interface DataContextType {
  data: any[];
  setData: React.Dispatch<React.SetStateAction<any[]>>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    const loadBackendTickets = async () => {
      const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';
      const token = typeof window !== 'undefined' ? localStorage.getItem('workwise_token') : null;

      if (!apiBase || !token) {
        return;
      }

      try {
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/tickets?t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load tickets');
        }

        const tickets = await response.json();
        if (Array.isArray(tickets)) {
          setData(tickets);
        }
      } catch (error) {
        console.warn('Failed to load backend tickets into dashboard context', error);
      }
    };

    loadBackendTickets();
  }, []);

  return (
    <DataContext.Provider value={{ data, setData }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}