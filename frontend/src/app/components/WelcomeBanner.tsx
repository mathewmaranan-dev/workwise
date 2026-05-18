import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Info, X } from 'lucide-react';
import { Button } from './ui/button';

interface WelcomeBannerProps {
  userName: string;
  role: string;
}

export function WelcomeBanner({ userName, role }: WelcomeBannerProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('welcomeBannerDismissed');
    if (!dismissed) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('welcomeBannerDismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <Alert className="mb-3 bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200 py-3 px-4">
      <Info className="h-3 w-3 text-indigo-600" />
      <AlertTitle className="text-sm text-indigo-900">Welcome to WORK-WISE, {userName}!</AlertTitle>
      <AlertDescription className="text-xs text-gray-700 mt-1">
        You're logged in as <strong>{role}</strong>. This dashboard provides real-time insights into IT service management performance.
        {role === 'Admin' && ' As an admin, you can manage users and upload new data.'}
        {role === 'ITSM Manager' && ' View team performance metrics and workload distribution.'}
        {role === 'Senior Management / HR' && ' Access organizational insights and strategic recommendations.'}
        {role === 'IT Support Agent' && ' View your task allocation and workload analysis.'}
      </AlertDescription>
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
    </Alert>
  );
}
