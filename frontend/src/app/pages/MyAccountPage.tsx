import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';

const validatePasswordStrength = (password: string) => {
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

  const handleProfileSave = () => {
    setProfileError('');
    setProfileMessage('');

    if (!name.trim()) {
      setProfileError('Name cannot be empty.');
      return;
    }

    const success = updateUser({ ...user, name: name.trim(), email: email.trim() });
    if (!success) {
      setProfileError('Unable to update account. Email may already be in use.');
      return;
    }

    setProfileMessage('Profile updated successfully.');
  };

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">My Account</h1>
        <p className="text-sm text-gray-600">Manage your profile and update your password securely.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="account-name">Name</Label>
              <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-email">Email</Label>
              <Input id="account-email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>

          {profileError && <p className="text-red-600 text-sm">{profileError}</p>}
          {profileMessage && <p className="text-green-600 text-sm">{profileMessage}</p>}

          <Button onClick={handleProfileSave}>Save Profile</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {passwordError && <p className="text-red-600 text-sm">{passwordError}</p>}
          {passwordMessage && <p className="text-green-600 text-sm">{passwordMessage}</p>}

          <Button onClick={handlePasswordSave}>Update Password</Button>
        </CardContent>
      </Card>
    </div>
  );
}
