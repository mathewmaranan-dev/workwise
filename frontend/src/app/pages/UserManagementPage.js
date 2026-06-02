import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { UserPlus, Edit, Trash2, Mail, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { assignmentGroups } from '../data/seedData';
export default function UserManagementPage() {
    const { users: authUsers, createUser, updateUser, deleteUser } = useAuth();
    const [users, setUsers] = React.useState([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [emailSuggestion, setEmailSuggestion] = useState('');
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        name: '',
        role: 'agent',
        assignment_group_id: undefined
    });
    // Sanitize name for email generation
    const sanitizeForEmail = (str) => {
        // Remove apostrophes and whitespace for the generated email local part
        return str.replace(/[\s']/g, '').replace(/[^a-zA-Z0-9]/g, '');
    };
    const env = import.meta.env;
    const API_BASE = env.VITE_API_BASE_URL || env.VITE_API_URL || '';
    const capitalizeName = (value) => {
        return value
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    };
    const getNextUserId = () => {
        return users.reduce((maxId, user) => {
            const numericId = Number(user.id);
            return Number.isFinite(numericId) ? Math.max(maxId, numericId) : maxId;
        }, 0) + 1;
    };
    const previewEmail = (firstName, lastName) => {
        if (!firstName || !lastName)
            return '';
        const sanitizedFirst = sanitizeForEmail(firstName).toLowerCase();
        const sanitizedLast = sanitizeForEmail(lastName).toLowerCase();
        const nextId = getNextUserId();
        return `${sanitizedFirst}.${sanitizedLast}${String(nextId).padStart(5, '0')}@workwise.it.com`;
    };
    const fetchSuggestedEmail = async (firstName, lastName) => {
        if (!firstName || !lastName)
            return;
        const fallbackEmail = previewEmail(firstName, lastName);
        setFormData((prev) => ({
            ...prev,
            name: `${capitalizeName(firstName)} ${capitalizeName(lastName)}`.trim(),
            email: fallbackEmail,
        }));
        try {
            const token = localStorage.getItem('workwise_token');
            const params = new URLSearchParams({ first_name: firstName, last_name: lastName });
            const base = API_BASE ? API_BASE : '';
            const fetchUrl = `${base}/api/users/next-email?${params.toString()}`;
            const response = await fetch(fetchUrl, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
            if (!response.ok) {
                setEmailSuggestion('Using local email preview while backend suggestion is unavailable.');
                return;
            }
            const data = await response.json();
            setFormData((prev) => ({
                ...prev,
                name: data.full_name || `${capitalizeName(firstName)} ${capitalizeName(lastName)}`.trim(),
                email: data.email || prev.email,
            }));
            setEmailSuggestion('Auto-generated email using next available user ID.');
        }
        catch (error) {
            console.error('Failed to fetch email suggestion', error);
            setEmailSuggestion('Using local email preview while backend suggestion is unavailable.');
        }
    };
    // Generate unique email
    const generateEmail = (firstName, lastName) => {
        if (!firstName || !lastName)
            return '';
        const sanitizedFirst = sanitizeForEmail(firstName);
        const sanitizedLast = sanitizeForEmail(lastName);
        // Preserve capitalization of first letters
        const firstCap = sanitizedFirst.charAt(0).toUpperCase() + sanitizedFirst.slice(1);
        const lastCap = sanitizedLast.charAt(0).toUpperCase() + sanitizedLast.slice(1);
        const baseEmail = `${sanitizeForEmail(firstName).toLowerCase()}.${sanitizeForEmail(lastName).toLowerCase()}@workwise.it.com`;
        let finalEmail = baseEmail;
        let counter = 1;
        while (users.some(u => u.email.toLowerCase() === finalEmail.toLowerCase())) {
            counter += 1;
            finalEmail = `${sanitizeForEmail(firstName).toLowerCase()}.${sanitizeForEmail(lastName).toLowerCase()}${String(counter).padStart(5, '0')}@workwise.it.com`;
        }
        if (finalEmail !== baseEmail) {
            setEmailSuggestion('Email taken. Suggested next available address applied.');
        }
        else {
            setEmailSuggestion('');
        }
        return finalEmail;
    };
    // Auto-fill full name and email when first and last names are available
    const handleFirstNameChange = (value) => {
        const trimmedValue = value.trim();
        const currentLastName = formData.lastName.trim();
        setFormData(prev => {
            const newName = trimmedValue && currentLastName
                ? `${capitalizeName(trimmedValue)} ${capitalizeName(currentLastName)}`
                : prev.name;
            return {
                ...prev,
                firstName: value,
                name: newName,
            };
        });
        if (trimmedValue && currentLastName) {
            fetchSuggestedEmail(trimmedValue, currentLastName);
        }
    };
    const handleLastNameChange = (value) => {
        const trimmedValue = value.trim();
        const currentFirstName = formData.firstName.trim();
        setFormData(prev => {
            const newName = currentFirstName && trimmedValue
                ? `${capitalizeName(currentFirstName)} ${capitalizeName(trimmedValue)}`
                : prev.name;
            return {
                ...prev,
                lastName: value,
                name: newName,
            };
        });
        if (currentFirstName && trimmedValue) {
            fetchSuggestedEmail(currentFirstName, trimmedValue);
        }
    };
    const handleEmailChange = (_value) => {
        // Email is read-only and auto-generated from the backend.
    };
    useEffect(() => {
        if (!formData.email && formData.firstName.trim() && formData.lastName.trim()) {
            fetchSuggestedEmail(formData.firstName.trim(), formData.lastName.trim());
        }
    }, [formData.firstName, formData.lastName]);
    // Check if form is valid
    const getEffectiveEmail = () => {
        const trimmedEmail = formData.email.trim();
        if (trimmedEmail) {
            return trimmedEmail.toLowerCase();
        }
        return previewEmail(formData.firstName, formData.lastName).toLowerCase();
    };
    const isFormValid = () => {
        const trimmedFirstName = formData.firstName.trim();
        const trimmedLastName = formData.lastName.trim();
        const trimmedEmail = getEffectiveEmail();
        const trimmedName = formData.name.trim();
        if (!trimmedFirstName || !trimmedLastName || !trimmedName || !trimmedEmail) {
            return false;
        }
        // Check email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            return false;
        }
        return true;
    };
    const handleAddUser = async () => {
        const trimmedFirstName = formData.firstName.trim();
        const trimmedLastName = formData.lastName.trim();
        const trimmedEmail = getEffectiveEmail();
        const trimmedName = formData.name.trim();
        if (!trimmedFirstName || !trimmedLastName || !trimmedEmail || !trimmedName) {
            toast.error('Please fill in all required fields');
            return;
        }
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            toast.error('Please enter a valid email address');
            return;
        }
        // Check email uniqueness
        if (users.some(u => u.email.toLowerCase() === trimmedEmail.toLowerCase())) {
            toast.error('Email already exists');
            return;
        }
        const newUser = {
            id: Date.now().toString(),
            email: trimmedEmail,
            name: trimmedName,
            role: formData.role,
            createdAt: new Date().toISOString().split('T')[0],
            first_name: formData.firstName.trim(),
            last_name: formData.lastName.trim(),
            assignment_group_id: formData.assignment_group_id,
        };
        const created = await createUser({ id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role, first_name: newUser.first_name, last_name: newUser.last_name, assignment_group_id: newUser.assignment_group_id }, '', newUser.assignment_group_id);
        if (!created) {
            toast.error('Email already exists or backend failed');
            return;
        }
        toast.success('User created successfully.');
        setIsAddDialogOpen(false);
        resetForm();
    };
    const handleUpdateUser = () => {
        if (!editingUser)
            return;
        const updated = {
            id: editingUser.id,
            email: formData.email,
            name: formData.name,
            role: formData.role,
            createdAt: editingUser.createdAt
        };
        updateUser({ id: updated.id, email: updated.email, name: updated.name, role: updated.role });
        toast.success(`User ${formData.name} updated successfully`);
        setEditingUser(null);
        resetForm();
    };
    const handleDeleteUser = async (userId) => {
        const user = users.find(u => u.id === userId);
        if (!user)
            return;
        const result = await deleteUser(user.email);
        if (!result || !result.success) {
            const msg = String((result && result.message) || '').toLowerCase();
            if (msg.includes('super admin') || msg.includes('cannot delete') || msg.includes('only the super admin')) {
                toast.error("Admin can't be deleted");
            }
            else {
                toast.error((result && result.message) || 'Cannot delete user');
            }
            return;
        }
        toast.success('User deleted successfully');
    };
    const resetForm = () => {
        setFormData({ firstName: '', lastName: '', email: '', name: '', role: 'agent', assignment_group_id: undefined });
        setEmailSuggestion('');
    };
    const openEditDialog = (user) => {
        setEditingUser(user);
        setFormData({
            firstName: '',
            lastName: '',
            email: user.email,
            name: user.name,
            role: user.role,
            assignment_group_id: user.assignment_group_id
        });
    };
    // keep local view-of-users in sync with auth context
    React.useEffect(() => {
        setUsers(authUsers.map(u => ({ ...u, createdAt: new Date().toISOString().split('T')[0] })));
    }, [authUsers]);
    const getRoleBadgeColor = (role) => {
        switch (role) {
            case 'admin': return 'bg-purple-100 text-purple-800';
            case 'manager': return 'bg-blue-100 text-blue-800';
            case 'hr': return 'bg-green-100 text-green-800';
            case 'agent': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };
    const getRoleLabel = (role) => {
        switch (role) {
            case 'admin': return 'Admin';
            case 'manager': return 'ITSM Manager';
            case 'hr': return 'Senior Management / HR';
            case 'agent': return 'IT Support Agent';
            default: return role;
        }
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900", children: "User Management" }), _jsx("p", { className: "text-gray-600 mt-1", children: "Manage system users and their access levels" })] }), _jsxs(Dialog, { open: isAddDialogOpen, onOpenChange: setIsAddDialogOpen, children: [_jsx(DialogTrigger, { asChild: true, children: _jsxs(Button, { onClick: resetForm, children: [_jsx(UserPlus, { className: "w-4 h-4 mr-2" }), "Add New User"] }) }), _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Add New User" }), _jsx(DialogDescription, { children: "Create a new user account with assigned role and credentials" })] }), _jsxs("div", { className: "space-y-4 py-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "lastName", children: "Last Name" }), _jsxs("div", { className: "relative", children: [_jsx(User, { className: "absolute left-3 top-3 h-4 w-4 text-gray-400" }), _jsx(Input, { id: "lastName", placeholder: "Doe", value: formData.lastName, onChange: (e) => handleLastNameChange(e.target.value), className: "pl-10" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "firstName", children: "First Name" }), _jsxs("div", { className: "relative", children: [_jsx(User, { className: "absolute left-3 top-3 h-4 w-4 text-gray-400" }), _jsx(Input, { id: "firstName", placeholder: "John", value: formData.firstName, onChange: (e) => handleFirstNameChange(e.target.value), className: "pl-10" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "name", children: "Full Name" }), _jsxs("div", { className: "relative", children: [_jsx(User, { className: "absolute left-3 top-3 h-4 w-4 text-gray-400" }), _jsx(Input, { id: "name", placeholder: "John Doe", value: formData.name, onChange: (e) => setFormData({ ...formData, name: e.target.value }), className: "pl-10" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "email", children: "Email" }), _jsxs("div", { className: "relative", children: [_jsx(Mail, { className: "absolute left-3 top-3 h-4 w-4 text-gray-400" }), _jsx(Input, { id: "email", type: "email", placeholder: "auto-generated", value: formData.email || previewEmail(formData.firstName, formData.lastName), readOnly: true, className: "pl-10 bg-gray-100 cursor-not-allowed" })] }), emailSuggestion && (_jsx("div", { className: "text-sm text-gray-500 mt-1", children: emailSuggestion })), formData.email && (_jsx("div", { className: "text-sm text-gray-500 mt-1", children: "Password is auto-generated from the same user-name pattern in camel-casing." }))] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "role", children: "Role" }), _jsxs(Select, { value: formData.role, onValueChange: (value) => setFormData({ ...formData, role: value }), children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "admin", children: "Admin" }), _jsx(SelectItem, { value: "manager", children: "ITSM Manager" }), _jsx(SelectItem, { value: "hr", children: "Senior Management / HR" }), _jsx(SelectItem, { value: "agent", children: "IT Support Agent" })] })] })] }), formData.role === 'agent' && (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "assignmentGroup", children: "Assignment Group (optional)" }), _jsxs(Select, { value: formData.assignment_group_id?.toString() || '', onValueChange: (value) => setFormData({
                                                            ...formData,
                                                            assignment_group_id: value === '__none' || value === '' ? undefined : parseInt(value)
                                                        }), children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, { placeholder: "Select a team..." }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "__none", children: "None" }), assignmentGroups.map(group => (_jsx(SelectItem, { value: group.assignment_group_id.toString(), children: group.group_name }, group.assignment_group_id)))] })] }), _jsx("p", { className: "text-xs text-gray-500", children: "Assign user to a support team for task allocation" })] }))] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setIsAddDialogOpen(false), children: "Cancel" }), _jsx(Button, { onClick: handleAddUser, disabled: !isFormValid(), children: "Create User" })] })] })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { children: ["All Users (", users.length, ")"] }) }), _jsx(CardContent, { children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b", children: [_jsx("th", { className: "text-left p-3 font-medium", children: "Name" }), _jsx("th", { className: "text-left p-3 font-medium", children: "Email" }), _jsx("th", { className: "text-left p-3 font-medium", children: "Role" }), _jsx("th", { className: "text-left p-3 font-medium", children: "Created" }), _jsx("th", { className: "text-right p-3 font-medium", children: "Actions" })] }) }), _jsx("tbody", { children: users.map(user => (_jsxs("tr", { className: "border-b hover:bg-gray-50", children: [_jsx("td", { className: "p-3 font-medium", children: user.name }), _jsx("td", { className: "p-3 text-gray-600", children: user.email }), _jsx("td", { className: "p-3", children: _jsx("span", { className: `px-2 py-1 rounded text-xs ${getRoleBadgeColor(user.role)}`, children: getRoleLabel(user.role) }) }), _jsx("td", { className: "p-3 text-gray-600", children: new Date(user.createdAt).toLocaleDateString() }), _jsx("td", { className: "p-3", children: _jsxs("div", { className: "flex items-center justify-end gap-2", children: [_jsxs(Dialog, { children: [_jsx(DialogTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "sm", onClick: () => openEditDialog(user), children: _jsx(Edit, { className: "w-4 h-4" }) }) }), _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Edit User" }), _jsx(DialogDescription, { children: "Update user information and role" })] }), _jsxs("div", { className: "space-y-4 py-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "edit-name", children: "Full Name" }), _jsx(Input, { id: "edit-name", value: formData.name, onChange: (e) => setFormData({ ...formData, name: e.target.value }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "edit-email", children: "Email" }), _jsx(Input, { id: "edit-email", type: "email", value: formData.email, onChange: (e) => setFormData({ ...formData, email: e.target.value }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "edit-role", children: "Role" }), _jsxs(Select, { value: formData.role, onValueChange: (value) => setFormData({ ...formData, role: value }), children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "admin", children: "Admin" }), _jsx(SelectItem, { value: "manager", children: "ITSM Manager" }), _jsx(SelectItem, { value: "hr", children: "Senior Management / HR" }), _jsx(SelectItem, { value: "agent", children: "IT Support Agent" })] })] })] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setEditingUser(null), children: "Cancel" }), _jsx(Button, { onClick: handleUpdateUser, children: "Update User" })] })] })] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleDeleteUser(user.id), className: "text-red-600 hover:text-red-700 hover:bg-red-50", children: _jsx(Trash2, { className: "w-4 h-4" }) })] }) })] }, user.id))) })] }) }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "User Statistics" }) }), _jsx(CardContent, { children: _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: [_jsxs("div", { className: "text-center p-4 bg-purple-50 rounded-lg", children: [_jsx("div", { className: "text-2xl font-bold text-purple-900", children: users.filter(u => u.role === 'admin').length }), _jsx("div", { className: "text-sm text-purple-700 mt-1", children: "Admins" })] }), _jsxs("div", { className: "text-center p-4 bg-blue-50 rounded-lg", children: [_jsx("div", { className: "text-2xl font-bold text-blue-900", children: users.filter(u => u.role === 'manager').length }), _jsx("div", { className: "text-sm text-blue-700 mt-1", children: "Managers" })] }), _jsxs("div", { className: "text-center p-4 bg-green-50 rounded-lg", children: [_jsx("div", { className: "text-2xl font-bold text-green-900", children: users.filter(u => u.role === 'hr').length }), _jsx("div", { className: "text-sm text-green-700 mt-1", children: "HR / Senior Mgmt" })] }), _jsxs("div", { className: "text-center p-4 bg-gray-50 rounded-lg", children: [_jsx("div", { className: "text-2xl font-bold text-gray-900", children: users.filter(u => u.role === 'agent').length }), _jsx("div", { className: "text-sm text-gray-700 mt-1", children: "Support Agents" })] })] }) })] })] }));
}
