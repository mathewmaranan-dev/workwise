import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

export default function TermsPromptPage() {
  const { user, acceptTerms, logout } = useAuth();
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    if (user.termsAccepted) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleAgree = async () => {
    await acceptTerms();
    toast.success('Thank you. Terms accepted.');
    navigate('/dashboard');
  };

  const handleDecline = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-3xl shadow-lg">
        <CardHeader className="space-y-3">
          <CardTitle className="text-3xl">Terms and Agreement</CardTitle>
          <p className="text-sm text-gray-600">
            You must accept the Terms and Conditions and Account Security Policy before accessing the system.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 text-sm text-gray-700">
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Terms and Conditions</h2>
              <p>
                By accessing WORK-WISE, you agree to comply with company policies, protect confidential data,
                and use the system only for approved work activities.
              </p>
              <p>
                Unauthorized access, data sharing, or misuse of system resources may result in account suspension.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Account Security Policy</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Keep your credentials confidential and do not share your password.</li>
                <li>Use strong passwords and change them regularly.</li>
                <li>Report suspicious account activity immediately.</li>
              </ul>
            </section>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox id="terms-checkbox" checked={agreed} onCheckedChange={(value) => setAgreed(Boolean(value))} />
            <Label htmlFor="terms-checkbox" className="text-sm text-gray-800">
              I have read and agree to the Terms and Account Security Policy.
            </Label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={handleDecline} className="w-full sm:w-auto">
              Decline
            </Button>
            <Button onClick={handleAgree} disabled={!agreed} className="w-full sm:w-auto">
              Agree and Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
