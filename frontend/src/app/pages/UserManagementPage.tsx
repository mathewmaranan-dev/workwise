import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { UserPlus, Edit, Trash2, Mail, Lock, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, User as AuthUser, UserRole } from '../context/AuthContext';
import { assignmentGroups } from '../data/seedData';

interface AppUser extends AuthUser { createdAt: string }

export default function UserManagementPage() {
  const { users: authUsers, createUser, updateUser, deleteUser } = useAuth();
  const [users, setUsers] = React.useState<AppUser[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [emailSuggestion, setEmailSuggestion] = useState('');
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    name: '',
    role: 'agent' as UserRole,
    assignment_group_id: undefined as number | undefined
  });

  // Sanitize name for email generation
  const sanitizeForEmail = (str: string): string => {
    // Remove apostrophes and whitespace for the generated email local part
    return str.replace(/[\s']/g, '').replace(/[^a-zA-Z0-9]/g, '');
  };

  const env = (import.meta as any).env as Record<string, string | undefined>;
  const API_BASE = env.VITE_API_BASE_URL || env.VITE_API_URL || '';

  const capitalizeName = (value: string): string => {
    return value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getNextUserId = (): number => {
    return users.reduce((maxId, user) => {
      const numericId = Number(user.id);
      return Number.isFinite(numericId) ? Math.max(maxId, numericId) : maxId;
    }, 0) + 1;
  };

  const previewEmail = (firstName: string, lastName: string): string => {
    if (!firstName || !lastName) return '';

    const sanitizedFirst = sanitizeForEmail(firstName).toLowerCase();
    const sanitizedLast = sanitizeForEmail(lastName).toLowerCase();
    const nextId = getNextUserId();

    return `${sanitizedFirst}.${sanitizedLast}${String(nextId).padStart(5, '0')}@workwise.it.com`;
  };

  const fetchSuggestedEmail = async (firstName: string, lastName: string) => {
    if (!firstName || !lastName) return;

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
    } catch (error) {
      console.error('Failed to fetch email suggestion', error);
      setEmailSuggestion('Using local email preview while backend suggestion is unavailable.');
    }
  };

  // Generate unique email
  const generateEmail = (firstName: string, lastName: string): string => {
    if (!firstName || !lastName) return '';
    
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
    } else {
      setEmailSuggestion('');
    }
    
    return finalEmail;
  };


  // Auto-fill full name and email when first and last names are available
  const handleFirstNameChange = (value: string) => {
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

  const handleLastNameChange = (value: string) => {
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

  const handleEmailChange = (_value: string) => {
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

  const isFormValid = (): boolean => {
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
    
    const newUser: AppUser = {
      id: Date.now().toString(),
      email: trimmedEmail,
      name: trimmedName,
      role: formData.role,
      createdAt: new Date().toISOString().split('T')[0],
      first_name: formData.firstName.trim(),
      last_name: formData.lastName.trim(),
      assignment_group_id: formData.assignment_group_id,
    };

    const created = await createUser(
      { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role, first_name: newUser.first_name, last_name: newUser.last_name, assignment_group_id: newUser.assignment_group_id },
      '',
      newUser.assignment_group_id
    );
    if (!created) {
      toast.error('Email already exists or backend failed');
      return;
    }

    toast.success('User created successfully.');
    setIsAddDialogOpen(false);
    resetForm();
  };

  const handleUpdateUser = () => {
    if (!editingUser) return;

    const updated: AppUser = {
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

  const handleDeleteUser = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const result = await deleteUser(user.email);
    if (!result.success) {
      const msg = String(result.message || '').toLowerCase();
      if (msg.includes('super admin') || msg.includes('cannot delete') || msg.includes('only the super admin')) {
        toast.error("Admin can't be deleted");
      } else {
        toast.error(result.message || 'Cannot delete user');
      }
      return;
    }
    toast.success('User deleted successfully');
  };

  const resetForm = () => {
    setFormData({ firstName: '', lastName: '', email: '', name: '', role: 'agent', assignment_group_id: undefined });
    setEmailSuggestion('');
  };

  const openEditDialog = (user: AppUser) => {
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

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'hr': return 'bg-green-100 text-green-800';
      case 'agent': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'manager': return 'ITSM Manager';
      case 'hr': return 'Senior Management / HR';
      case 'agent': return 'IT Support Agent';
      default: return role;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage system users and their access levels</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add New User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account with assigned role and credentials
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={(e) => handleLastNameChange(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="firstName"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={(e) => handleFirstNameChange(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="auto-generated"
                    value={formData.email || previewEmail(formData.firstName, formData.lastName)}
                    readOnly
                    className="pl-10 bg-gray-100 cursor-not-allowed"
                  />
                </div>
                {emailSuggestion && (
                  <div className="text-sm text-gray-500 mt-1">
                    {emailSuggestion}
                  </div>
                )}
                {formData.email && (
                  <div className="text-sm text-gray-500 mt-1">
                    Password is auto-generated from the same user-name pattern in camel-casing.
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">ITSM Manager</SelectItem>
                    <SelectItem value="hr">Senior Management / HR</SelectItem>
                    <SelectItem value="agent">IT Support Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {formData.role === 'agent' && (
                <div className="space-y-2">
                  <Label htmlFor="assignmentGroup">Assignment Group (optional)</Label>
                  <Select 
                    value={formData.assignment_group_id?.toString() || ''} 
                    onValueChange={(value) => setFormData({ 
                      ...formData, 
                      assignment_group_id: value === '__none' || value === '' ? undefined : parseInt(value) 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a team..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">None</SelectItem>
                      {assignmentGroups.map(group => (
                        <SelectItem key={group.assignment_group_id} value={group.assignment_group_id.toString()}>
                          {group.group_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">Assign user to a support team for task allocation</p>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddUser} disabled={!isFormValid()}>Create User</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-left p-3 font-medium">Role</th>
                  <th className="text-left p-3 font-medium">Created</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{user.name}</td>
                    <td className="p-3 text-gray-600">{user.email}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs ${getRoleBadgeColor(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600">{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(user)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit User</DialogTitle>
                              <DialogDescription>
                                Update user information and role
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="edit-name">Full Name</Label>
                                <Input
                                  id="edit-name"
                                  value={formData.name}
                                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label htmlFor="edit-email">Email</Label>
                                <Input
                                  id="edit-email"
                                  type="email"
                                  value={formData.email}
                                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label htmlFor="edit-role">Role</Label>
                                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="manager">ITSM Manager</SelectItem>
                                    <SelectItem value="hr">Senior Management / HR</SelectItem>
                                    <SelectItem value="agent">IT Support Agent</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setEditingUser(null)}>
                                Cancel
                              </Button>
                              <Button onClick={handleUpdateUser}>Update User</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-900">
                {users.filter(u => u.role === 'admin').length}
              </div>
              <div className="text-sm text-purple-700 mt-1">Admins</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-900">
                {users.filter(u => u.role === 'manager').length}
              </div>
              <div className="text-sm text-blue-700 mt-1">Managers</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-900">
                {users.filter(u => u.role === 'hr').length}
              </div>
              <div className="text-sm text-green-700 mt-1">HR / Senior Mgmt</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {users.filter(u => u.role === 'agent').length}
              </div>
              <div className="text-sm text-gray-700 mt-1">Support Agents</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}