import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState } from 'react';
const DataContext = createContext(undefined);
export function DataProvider({ children }) {
    const [data, setData] = useState([]);
    return (_jsx(DataContext.Provider, { value: { data, setData }, children: children }));
}
export function useData() {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
}
