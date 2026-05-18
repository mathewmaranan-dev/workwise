import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Ticket } from '../data/seedData';
import { tickets as seedTickets } from '../data/seedData';

interface TicketsContextType {
  tickets: Ticket[];
  setTickets: (t: Ticket[]) => void;
  resetToSeed: () => void;
}

const TicketsContext = createContext<TicketsContextType | undefined>(undefined);

export function TicketsProvider({ children }: { children: React.ReactNode }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    // initialize from seed data or localStorage
    const stored = localStorage.getItem('workwise_tickets');
    if (stored) {
      try {
        setTickets(JSON.parse(stored));
        return;
      } catch {
        // fall through to seed
      }
    }
    setTickets(seedTickets);
  }, []);

  useEffect(() => {
    // persist small dataset to localStorage
    try {
      localStorage.setItem('workwise_tickets', JSON.stringify(tickets));
    } catch {
      // ignore storage errors
    }
  }, [tickets]);

  const resetToSeed = () => setTickets(seedTickets);

  return (
    <TicketsContext.Provider value={{ tickets, setTickets, resetToSeed }}>
      {children}
    </TicketsContext.Provider>
  );
}

export function useTickets() {
  const ctx = useContext(TicketsContext);
  if (!ctx) throw new Error('useTickets must be used within TicketsProvider');
  return ctx;
}
