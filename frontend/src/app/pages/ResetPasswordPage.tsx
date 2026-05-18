import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';

const validatePasswordStrength = (password: string) => {
  const minLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  return minLength && hasUpper && hasLower && hasNumber && hasSymbol;
};

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { validateResetToken, resetPassword } = useAuth();
  const [isValidToken, setIsValidToken] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    setIsValidToken(validateResetToken(token));
    setInitialized(true);
  }, [token, validateResetToken]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!newPassword || !confirmPassword) {
      setError('Please enter and confirm your new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (!validatePasswordStrength(newPassword)) {
      setError('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.');
      return;
    }

    if (!token) {
      setError('Invalid reset link.');
      return;
    }

    const success = await resetPassword(token, newPassword);
    if (!success) {
      setError('The reset link is invalid or has expired. Please request a new one.');
      return;
    }

    toast.success('Password reset successfully. Please sign in.');
    navigate('/login');
  };

  if (!initialized) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <p className="text-sm text-gray-600">Create a new password for your account.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isValidToken ? (
            <div className="space-y-3 text-sm text-gray-700">
              <p>The reset link is invalid or has expired.</p>
              <Link to="/forgot-password" className="text-indigo-600 hover:text-indigo-800">
                Request a new password reset link.
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                />
              </div>

              {error && <div className="text-red-600 text-sm">{error}</div>}

              <Button type="submit" className="w-full">
                Reset Password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
