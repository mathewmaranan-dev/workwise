import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
const validatePasswordStrength = (password) => {
    const isLongEnough = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    return isLongEnough && hasUpper && hasLower && hasNumber && hasSymbol;
};
export default function MyAccountPage() {
    const { user, updateUser, changePassword } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [profileMessage, setProfileMessage] = useState('');
    const [passwordMessage, setPasswordMessage] = useState('');
    const [profileError, setProfileError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        setName(user.name);
        setEmail(user.email);
    }, [user, navigate]);
    if (!user) {
        return null;
    }
    const handlePasswordSave = async () => {
        setPasswordError('');
        setPasswordMessage('');
        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordError('Please fill in all password fields.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match.');
            return;
        }
        if (!validatePasswordStrength(newPassword)) {
            setPasswordError('Password must be 8+ chars and include uppercase, lowercase, number, and symbol.');
            return;
        }
        const success = await changePassword(currentPassword, newPassword);
        if (!success) {
            setPasswordError('Current password is incorrect.');
            return;
        }
        setPasswordMessage('Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900", children: "My Account" }), _jsx("p", { className: "text-sm text-gray-600", children: "Manage your profile and update your password securely." })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { className: "text-lg", children: "Profile Information" }) }), _jsx(CardContent, { className: "space-y-4", children: _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "account-name", children: "Name" }), _jsx(Input, { id: "account-name", value: name, readOnly: true, className: "bg-gray-100 cursor-not-allowed" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "account-email", children: "Email" }), _jsx(Input, { id: "account-email", value: email, readOnly: true, className: "bg-gray-100 cursor-not-allowed" })] })] }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { className: "text-lg", children: "Change Password" }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "current-password", children: "Current Password" }), _jsx(Input, { id: "current-password", type: "password", value: currentPassword, onChange: (e) => setCurrentPassword(e.target.value) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "new-password", children: "New Password" }), _jsx(Input, { id: "new-password", type: "password", value: newPassword, onChange: (e) => setNewPassword(e.target.value) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "confirm-password", children: "Confirm New Password" }), _jsx(Input, { id: "confirm-password", type: "password", value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value) })] })] }), passwordError && _jsx("p", { className: "text-red-600 text-sm", children: passwordError }), passwordMessage && _jsx("p", { className: "text-green-600 text-sm", children: passwordMessage }), _jsx(Button, { onClick: handlePasswordSave, children: "Update Password" })] })] })] }));
}
