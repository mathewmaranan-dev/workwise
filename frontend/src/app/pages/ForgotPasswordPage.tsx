import React, { useState } from 'react';
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

  const handleSubmit = async (event: React.FormEvent) => {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Forgot Password</CardTitle>
          <p className="text-sm text-gray-600">Enter your registered email to receive a password reset link.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email Address</Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="your.email@workwise.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {error && <div className="text-red-600 text-sm">{error}</div>}
            {message && <div className="text-green-600 text-sm">{message}</div>}
            {resetLink && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-900">Demo reset link</p>
                <a href={resetLink} className="text-indigo-600 hover:text-indigo-800 break-all">
                  {resetLink}
                </a>
              </div>
            )}

            <Button type="submit" className="w-full">
              Send Reset Link
            </Button>
          </form>

          <div className="text-sm text-center">
            <Link to="/login" className="text-indigo-600 hover:text-indigo-800">
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
