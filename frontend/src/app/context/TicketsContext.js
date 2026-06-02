import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect } from 'react';
import { tickets as seedTickets } from '../data/seedData';
const TicketsContext = createContext(undefined);
export function TicketsProvider({ children }) {
    const [tickets, setTickets] = useState([]);
    useEffect(() => {
        // initialize from seed data or localStorage
        const stored = localStorage.getItem('workwise_tickets');
        if (stored) {
            try {
                setTickets(JSON.parse(stored));
                return;
            }
            catch {
                // fall through to seed
            }
        }
        setTickets(seedTickets);
    }, []);
    useEffect(() => {
        // persist small dataset to localStorage
        try {
            localStorage.setItem('workwise_tickets', JSON.stringify(tickets));
        }
        catch {
            // ignore storage errors
        }
    }, [tickets]);
    const resetToSeed = () => setTickets(seedTickets);
    return (_jsx(TicketsContext.Provider, { value: { tickets, setTickets, resetToSeed }, children: children }));
}
export function useTickets() {
    const ctx = useContext(TicketsContext);
    if (!ctx)
        throw new Error('useTickets must be used within TicketsProvider');
    return ctx;
}
