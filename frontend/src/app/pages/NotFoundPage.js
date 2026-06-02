import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Home, ArrowLeft } from 'lucide-react';
export default function NotFoundPage() {
    const navigate = useNavigate();
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-gray-50 p-4", children: _jsxs("div", { className: "text-center space-y-6 max-w-md", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-9xl font-bold text-indigo-600", children: "404" }), _jsx("h2", { className: "text-2xl font-semibold text-gray-900 mt-4", children: "Page Not Found" }), _jsx("p", { className: "text-gray-600 mt-2", children: "The page you're looking for doesn't exist or you don't have permission to access it." })] }), _jsxs("div", { className: "flex gap-4 justify-center", children: [_jsxs(Button, { variant: "outline", onClick: () => navigate(-1), children: [_jsx(ArrowLeft, { className: "w-4 h-4 mr-2" }), "Go Back"] }), _jsxs(Button, { onClick: () => navigate('/dashboard'), children: [_jsx(Home, { className: "w-4 h-4 mr-2" }), "Go to Dashboard"] })] })] }) }));
}
