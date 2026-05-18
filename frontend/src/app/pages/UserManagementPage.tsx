import React, { useState } from 'react';
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

// Common weak passwords to reject
const WEAK_PASSWORDS = [
  'password', 'password1', 'password123', '123456', '12345678',
  'qwerty', 'abc123', 'letmein', 'welcome', 'admin', 'user'
];

export default function UserManagementPage() {
  const { users: authUsers, createUser, updateUser, deleteUser } = useAuth();
  const [users, setUsers] = React.useState<AppUser[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [emailManuallyEdited, setEmailManuallyEdited] = useState(false);
  const [emailSuggestion, setEmailSuggestion] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    name: '',
    role: 'agent' as UserRole,
    password: '',
    assignment_group_id: undefined as number | undefined
  });

  // Sanitize name for email generation
  const sanitizeForEmail = (str: string): string => {
    // Remove spaces and apostrophes, keep only letters and digits
    return str.replace(/[\s']/g, '').replace(/[^a-zA-Z0-9]/g, '');
  };

  // Generate unique email
  const generateEmail = (firstName: string, lastName: string): string => {
    if (!firstName || !lastName) return '';
    
    const sanitizedFirst = sanitizeForEmail(firstName);
    const sanitizedLast = sanitizeForEmail(lastName);
    
    // Preserve capitalization of first letters
    const firstCap = sanitizedFirst.charAt(0).toUpperCase() + sanitizedFirst.slice(1);
    const lastCap = sanitizedLast.charAt(0).toUpperCase() + sanitizedLast.slice(1);
    
    const baseEmail = `${firstCap}${lastCap}@workwise.app`;
    
    // Check if email exists
    let finalEmail = baseEmail;
    let counter = 2;
    
    while (users.some(u => u.email.toLowerCase() === finalEmail.toLowerCase())) {
      finalEmail = `${firstCap}${lastCap}${counter}@workwise.app`;
      counter++;
    }
    
    if (finalEmail !== baseEmail) {
      setEmailSuggestion('Email taken. Suggested next available address applied.');
    } else {
      setEmailSuggestion('');
    }
    
    return finalEmail;
  };

  // Validate password strength
  const validatePassword = (password: string): string => {
    if (!password) return '';
    
    if (password.length < 8) {
      return 'Use at least 8 characters.';
    }
    
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[!@#$%^&*?_+=\-]/.test(password);
    
    if (!hasLetter || !hasNumber || !hasSymbol) {
      return 'Add letters, numbers, and a symbol.';
    }
    
    // Check for weak passwords
    const lowerPassword = password.toLowerCase();
    if (WEAK_PASSWORDS.some(weak => lowerPassword.includes(weak))) {
      return 'Avoid using your name or very common passwords.';
    }
    
    // Check if password contains first or last name
    const firstName = formData.firstName.trim().toLowerCase();
    const lastName = formData.lastName.trim().toLowerCase();
    
    if (firstName && lowerPassword.includes(firstName)) {
      return 'Avoid using your name or very common passwords.';
    }
    
    if (lastName && lowerPassword.includes(lastName)) {
      return 'Avoid using your name or very common passwords.';
    }
    
    return '';
  };

  // Auto-fill full name and email when first and last names are available
  const handleFirstNameChange = (value: string) => {
    const trimmedValue = value.trim();
    setFormData(prev => {
      const newData = {
        ...prev,
        firstName: value,
        name: trimmedValue && prev.lastName.trim() ? `${trimmedValue} ${prev.lastName.trim()}` : prev.name
      };
      
      // Auto-generate email if not manually edited
      if (!emailManuallyEdited && trimmedValue && prev.lastName.trim()) {
        newData.email = generateEmail(trimmedValue, prev.lastName.trim());
      }
      
      return newData;
    });
    
    // Revalidate password if it exists
    if (formData.password) {
      setPasswordError(validatePassword(formData.password));
    }
  };

  const handleLastNameChange = (value: string) => {
    const trimmedValue = value.trim();
    setFormData(prev => {
      const newData = {
        ...prev,
        lastName: value,
        name: prev.firstName.trim() && trimmedValue ? `${prev.firstName.trim()} ${trimmedValue}` : prev.name
      };
      
      // Auto-generate email if not manually edited
      if (!emailManuallyEdited && prev.firstName.trim() && trimmedValue) {
        newData.email = generateEmail(prev.firstName.trim(), trimmedValue);
      }
      
      return newData;
    });
    
    // Revalidate password if it exists
    if (formData.password) {
      setPasswordError(validatePassword(formData.password));
    }
  };

  const handleEmailChange = (value: string) => {
    setEmailManuallyEdited(true);
    setEmailSuggestion('');
    setFormData(prev => ({ ...prev, email: value }));
  };

  const handlePasswordChange = (value: string) => {
    setFormData(prev => ({ ...prev, password: value }));
    setPasswordError(validatePassword(value));
  };

  // Check if form is valid
  const isFormValid = (): boolean => {
    const trimmedFirstName = formData.firstName.trim();
    const trimmedLastName = formData.lastName.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedName = formData.name.trim();
    const trimmedPassword = formData.password.trim();
    
    if (!trimmedFirstName || !trimmedLastName || !trimmedName || !trimmedEmail || !trimmedPassword) {
      return false;
    }
    
    // Check email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return false;
    }
    
    // Check password validation
    if (validatePassword(trimmedPassword)) {
      return false;
    }
    
    return true;
  };

  const handleAddUser = async () => {
    const trimmedFirstName = formData.firstName.trim();
    const trimmedLastName = formData.lastName.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedName = formData.name.trim();
    const trimmedPassword = formData.password.trim();
    
    if (!trimmedFirstName || !trimmedLastName || !trimmedEmail || !trimmedName || !trimmedPassword) {
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
    
    // Password validation
    const passwordValidation = validatePassword(trimmedPassword);
    if (passwordValidation) {
      toast.error('Please provide a stronger password');
      return;
    }

    const newUser: AppUser = {
      id: Date.now().toString(),
      email: trimmedEmail,
      name: trimmedName,
      role: formData.role,
      createdAt: new Date().toISOString().split('T')[0]
    };

    const created = await createUser({ id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role }, trimmedPassword);
    if (!created) {
      toast.error('Email already exists');
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

  const handleDeleteUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const ok = deleteUser(user.email);
    if (!ok) {
      toast.error('Cannot delete user (maybe last admin)');
      return;
    }
    toast.success('User deleted successfully');
  };

  const resetForm = () => {
    setFormData({ firstName: '', lastName: '', email: '', name: '', role: 'agent', password: '', assignment_group_id: undefined });
    setEmailManuallyEdited(false);
    setEmailSuggestion('');
    setPasswordError('');
  };

  const openEditDialog = (user: AppUser) => {
    setEditingUser(user);
    setFormData({
      firstName: '',
      lastName: '',
      email: user.email,
      name: user.name,
      role: user.role,
      password: ''
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
                    placeholder="john@workwise.app"
                    value={formData.email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {emailSuggestion && (
                  <div className="text-sm text-gray-500 mt-1">
                    {emailSuggestion}
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mix of letters, numbers, and symbols"
                    value={formData.password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {passwordError && (
                  <div className="text-sm text-red-500 mt-1">
                    {passwordError}
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