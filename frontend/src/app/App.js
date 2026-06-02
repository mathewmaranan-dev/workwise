import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RouterProvider } from 'react-router';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';
export default function App() {
    return (_jsx(AuthProvider, { children: _jsxs(DataProvider, { children: [_jsx(RouterProvider, { router: router }), _jsx(Toaster, {})] }) }));
}
