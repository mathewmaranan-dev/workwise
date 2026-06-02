import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Info, X } from 'lucide-react';
import { Button } from './ui/button';
export function WelcomeBanner({ userName, role }) {
    const [isVisible, setIsVisible] = useState(false);
    useEffect(() => {
        const dismissed = localStorage.getItem('welcomeBannerDismissed');
        if (!dismissed) {
            setIsVisible(true);
        }
    }, []);
    const handleDismiss = () => {
        setIsVisible(false);
        localStorage.setItem('welcomeBannerDismissed', 'true');
    };
    if (!isVisible)
        return null;
    return (_jsxs(Alert, { className: "mb-3 bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200 py-3 px-4", children: [_jsx(Info, { className: "h-3 w-3 text-indigo-600" }), _jsxs(AlertTitle, { className: "text-sm text-indigo-900", children: ["Welcome to WORK-WISE, ", userName, "!"] }), _jsxs(AlertDescription, { className: "text-xs text-gray-700 mt-1", children: ["You're logged in as ", _jsx("strong", { children: role }), ". This dashboard provides real-time insights into IT service management performance.", role === 'Admin' && ' As an admin, you can manage users and upload new data.', role === 'ITSM Manager' && ' View team performance metrics and workload distribution.', role === 'Senior Management / HR' && ' Access organizational insights and strategic recommendations.', role === 'IT Support Agent' && ' View your task allocation and workload analysis.'] }), _jsx(Button, { variant: "ghost", size: "sm", className: "absolute top-2 right-2", onClick: handleDismiss, children: _jsx(X, { className: "h-4 w-4" }) })] }));
}
