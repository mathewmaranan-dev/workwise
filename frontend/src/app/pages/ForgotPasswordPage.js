import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
export default function ForgotPasswordPage() {
    const { forgotPassword } = useAuth();
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [resetLink, setResetLink] = useState('');
    const [error, setError] = useState('');
    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setMessage('');
        setResetLink('');
        const token = await forgotPassword(email.trim());
        if (!token) {
            setError('No account found for that email.');
            return;
        }
        const link = `${window.location.origin}/reset-password/${token}`;
        setMessage('A password reset link has been generated for your account.');
        setResetLink(link);
        toast.success('Password reset link created.');
        console.log('Password reset link:', link);
    };
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-slate-50 p-4", children: _jsxs(Card, { className: "w-full max-w-md shadow-lg", children: [_jsxs(CardHeader, { className: "space-y-2", children: [_jsx(CardTitle, { className: "text-2xl", children: "Forgot Password" }), _jsx("p", { className: "text-sm text-gray-600", children: "Enter your registered email to receive a password reset link." })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "forgot-email", children: "Email Address" }), _jsx(Input, { id: "forgot-email", type: "email", placeholder: "your.email@workwise.app", value: email, onChange: (e) => setEmail(e.target.value), required: true })] }), error && _jsx("div", { className: "text-red-600 text-sm", children: error }), message && _jsx("div", { className: "text-green-600 text-sm", children: message }), resetLink && (_jsxs("div", { className: "rounded-md border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsx("p", { className: "font-medium text-slate-900", children: "Demo reset link" }), _jsx("a", { href: resetLink, className: "text-indigo-600 hover:text-indigo-800 break-all", children: resetLink })] })), _jsx(Button, { type: "submit", className: "w-full", children: "Send Reset Link" })] }), _jsx("div", { className: "text-sm text-center", children: _jsx(Link, { to: "/login", className: "text-indigo-600 hover:text-indigo-800", children: "Back to sign in" }) })] })] }) }));
}
