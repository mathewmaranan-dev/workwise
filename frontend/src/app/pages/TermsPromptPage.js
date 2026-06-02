import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
export default function TermsPromptPage() {
    const { user, acceptTerms, logout } = useAuth();
    const navigate = useNavigate();
    const [agreed, setAgreed] = useState(false);
    useEffect(() => {
        if (!user) {
            navigate('/login', { replace: true });
            return;
        }
        if (user.termsAccepted) {
            navigate('/dashboard', { replace: true });
        }
    }, [user, navigate]);
    const handleAgree = async () => {
        await acceptTerms();
        toast.success('Thank you. Terms accepted.');
        navigate('/dashboard');
    };
    const handleDecline = () => {
        logout();
        navigate('/login');
    };
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-slate-50 p-4", children: _jsxs(Card, { className: "w-full max-w-3xl shadow-lg", children: [_jsxs(CardHeader, { className: "space-y-3", children: [_jsx(CardTitle, { className: "text-3xl", children: "Terms and Agreement" }), _jsx("p", { className: "text-sm text-gray-600", children: "You must accept the Terms and Conditions and Account Security Policy before accessing the system." })] }), _jsxs(CardContent, { className: "space-y-6", children: [_jsxs("div", { className: "space-y-4 text-sm text-gray-700", children: [_jsxs("section", { className: "space-y-2", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Terms and Conditions" }), _jsx("p", { children: "By accessing WORK-WISE, you agree to comply with company policies, protect confidential data, and use the system only for approved work activities." }), _jsx("p", { children: "Unauthorized access, data sharing, or misuse of system resources may result in account suspension." })] }), _jsxs("section", { className: "space-y-2", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Account Security Policy" }), _jsxs("ul", { className: "list-disc list-inside space-y-1", children: [_jsx("li", { children: "Keep your credentials confidential and do not share your password." }), _jsx("li", { children: "Use strong passwords and change them regularly." }), _jsx("li", { children: "Report suspicious account activity immediately." })] })] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Checkbox, { id: "terms-checkbox", checked: agreed, onCheckedChange: (value) => setAgreed(Boolean(value)) }), _jsx(Label, { htmlFor: "terms-checkbox", className: "text-sm text-gray-800", children: "I have read and agree to the Terms and Account Security Policy." })] }), _jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:justify-end", children: [_jsx(Button, { variant: "outline", onClick: handleDecline, className: "w-full sm:w-auto", children: "Decline" }), _jsx(Button, { onClick: handleAgree, disabled: !agreed, className: "w-full sm:w-auto", children: "Agree and Continue" })] })] })] }) }));
}
