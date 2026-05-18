import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { AlertCircle } from 'lucide-react';

// Fuzzy search function to find closest match
const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  let matches = 0;
  let minLen = Math.min(s1.length, s2.length);
  
  for (let i = 0; i < minLen; i++) {
    if (s1[i] === s2[i]) matches++;
  }
  
  return matches / Math.max(s1.length, s2.length);
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);
  const [runtimeEmails, setRuntimeEmails] = useState<string[]>([]);
  
  const emailInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { login, users: authUsers } = useAuth();

  // Load runtime emails from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('runtimeEmails');
    if (stored) {
      setRuntimeEmails(JSON.parse(stored));
    }
  }, []);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    
    // Show suggestions only if 3 or more characters
    if (value.length >= 3) {
      const q = value.toLowerCase();
      
      // Combine auth users and runtime emails
      const allEmails = [
        ...authUsers.map(u => u.email),
        ...runtimeEmails
      ];
      const uniqueEmails = [...new Set(allEmails)];
      
      // Find matches with fuzzy matching
      const matches = uniqueEmails
        .map(email => ({
          email,
          similarity: calculateSimilarity(q, email)
        }))
        .filter(item => item.similarity > 0.3 || item.email.toLowerCase().includes(q))
        .sort((a, b) => {
          // Sort by similarity (fuzzy match) first, then by includes match
          if (b.similarity !== a.similarity) return b.similarity - a.similarity;
          return item.email.toLowerCase().indexOf(q) - item.email.toLowerCase().indexOf(q);
        })
        .slice(0, 5) // Show top 5 matches
        .map(item => item.email);
      
      setEmailSuggestions(matches);
      setShowEmailSuggestions(matches.length > 0);
    } else {
      setShowEmailSuggestions(false);
    }
  };

  const handleSelectEmail = (selectedEmail: string) => {
    setEmail(selectedEmail);
    setShowEmailSuggestions(false);
    
    // Add to runtime emails
    if (!runtimeEmails.includes(selectedEmail)) {
      const updated = [selectedEmail, ...runtimeEmails];
      setRuntimeEmails(updated);
      sessionStorage.setItem('runtimeEmails', JSON.stringify(updated));
    }
    
    // Focus on password field
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    passwordInput?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Track this email in runtime
    if (!runtimeEmails.includes(email)) {
      const updated = [email, ...runtimeEmails];
      setRuntimeEmails(updated);
      sessionStorage.setItem('runtimeEmails', JSON.stringify(updated));
    }

    const result = await login(email, password);
    
    if (result.success) {
      if (result.termsAccepted) {
        navigate('/dashboard');
      } else {
        navigate('/terms');
      }
    } else {
      setError('Invalid email or password');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8 items-center">
        {/* Left side - Branding */}
        <div className="text-center md:text-left space-y-6">
          <div className="inline-block">
            <h1 className="text-5xl font-bold text-indigo-900 mb-2">WORK-WISE</h1>
            <p className="text-xl text-indigo-700">Intelligent IT Service Management System</p>
          </div>
          
          <div className="space-y-4 text-gray-700">
            <p className="text-lg">Enterprise-grade ITSM analytics and insights</p>
            <ul className="space-y-2 text-left inline-block">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                Real-time ticket monitoring
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                Role-based dashboards
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                Team performance analytics
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                Intelligent insights
              </li>
            </ul>
          </div>
        </div>

        {/* Right side - Login form */}
        <Card className="w-full shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Sign In</CardTitle>
            <CardDescription>Enter your credentials to access WORK-WISE</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Input
                    ref={emailInputRef}
                    id="email"
                    type="email"
                    placeholder="your.email@workwise.app"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    onFocus={() => email.length >= 3 && emailSuggestions.length > 0 && setShowEmailSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowEmailSuggestions(false), 200)}
                    required
                    autoComplete="email"
                  />
                  
                  {showEmailSuggestions && emailSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                      {emailSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => handleSelectEmail(suggestion)}
                          className="w-full text-left px-4 py-2 hover:bg-indigo-50 transition-colors border-b last:border-b-0 focus:bg-indigo-50 text-sm"
                        >
                          <div className="font-medium text-gray-900">{suggestion}</div>
                          {runtimeEmails.includes(suggestion) && (
                            <div className="text-xs text-gray-500">Previously used</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between">
                <Link to="/forgot-password" className="text-sm text-indigo-600 hover:text-indigo-800">
                  Forgot password?
                </Link>
                <Button type="submit" className="ml-4" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </div>
            </form>
            
            {/* Demo credentials removed per request */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}