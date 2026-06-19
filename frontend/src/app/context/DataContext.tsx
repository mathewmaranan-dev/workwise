import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

interface DataContextType {
  data: any[];
  setData: React.Dispatch<React.SetStateAction<any[]>>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<any[]>([]);
  const { isAuthReady, user } = useAuth();
  const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const loadBackendTickets = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('workwise_token') : null;

      if (!token) {
        setData([]);
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
        setData(Array.isArray(tickets) ? tickets : []);
      } catch (error) {
        console.warn('Failed to load backend tickets into dashboard context', error);
        setData([]);
      }
    };

    if (!isAuthReady) {
      return;
    }

    loadBackendTickets();
  }, [apiBase, isAuthReady, user?.id]);

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