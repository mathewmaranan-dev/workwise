import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

interface Props {
  apiBase: string;
}

export default function ScenarioTester({ apiBase }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [form, setForm] = useState<any>({
    ticket_category: 'software',
    priority: 3,
    assigned_group: 1,
    assigned_to_id: 1,
    impact_id: 3,
    urgency_id: 2,
    reopen_count: 0,
    reassignment_count: 0,
    duration: 120,
    ticket_complexity: 6,
    agent_fcr_history: 0.72,
    category_non_fcr_rate: 0.2,
  });

  const submit = async () => {
    setLoading(true);
    setResult(null);
    try {
      const resp = await fetch(`${apiBase.replace(/\/$/, '')}/api/ml/fcr/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await resp.json();
      setResult(data);
    } catch (e) {
      setResult({ error: String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scenario Tester</CardTitle>
        <p className="text-xs text-gray-500 mt-1">Quickly test a ticket scenario and view predicted Non-FCR risk and recommendations.</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs">Category</label>
            <input className="w-full p-2 border rounded" value={form.ticket_category} onChange={(e) => setForm({...form, ticket_category: e.target.value})} />
          </div>
          <div>
            <label className="text-xs">Assigned to (id)</label>
            <input type="number" className="w-full p-2 border rounded" value={form.assigned_to_id} onChange={(e) => setForm({...form, assigned_to_id: Number(e.target.value)})} />
          </div>
          <div>
            <label className="text-xs">Priority (1-4)</label>
            <input type="number" min={1} max={4} className="w-full p-2 border rounded" value={form.priority} onChange={(e) => setForm({...form, priority: Number(e.target.value)})} />
          </div>
          <div>
            <label className="text-xs">Reopen count</label>
            <input type="number" className="w-full p-2 border rounded" value={form.reopen_count} onChange={(e) => setForm({...form, reopen_count: Number(e.target.value)})} />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button onClick={submit} disabled={loading}>{loading ? 'Running…' : 'Predict risk'}</Button>
        </div>

        {result && (
          <div className="mt-4">
            <pre className="text-sm bg-gray-50 p-3 rounded">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
