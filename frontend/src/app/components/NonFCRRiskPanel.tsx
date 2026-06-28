import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useLookupData } from '../hooks/useLookupData';
import { getUserById } from '../data/seedData';

interface Props {
  tickets: any[];
  riskScoreMap: Record<string, any>;
}

export default function NonFCRRiskPanel({ tickets, riskScoreMap }: Props) {
  const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';
  const { getCategoryName } = useLookupData(apiBase);
  const { topAgents, topCategories, highRiskCount } = useMemo(() => {
    const agentMap: Record<number, number[]> = {};
    const categoryMap: Record<number, number[]> = {};
    let highRisk = 0;

    tickets.forEach((t) => {
      if (!t || typeof t !== 'object') return;
      const scoreEntry = riskScoreMap[t.ticket_id];
      const score = scoreEntry?.riskScore ?? null;
      if (score !== null) {
        if (!agentMap[t.assigned_to_id]) agentMap[t.assigned_to_id] = [];
        agentMap[t.assigned_to_id].push(score);

        if (!categoryMap[t.category_id]) categoryMap[t.category_id] = [];
        categoryMap[t.category_id].push(score);

        if (score >= 70) highRisk += 1;
      }
    });

    const topAgents = Object.entries(agentMap)
      .map(([k, v]) => ({ id: Number(k), avg: v.reduce((a, b) => a + b, 0) / v.length, count: v.length }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);

    const topCategories = Object.entries(categoryMap)
      .map(([k, v]) => ({ id: Number(k), avg: v.reduce((a, b) => a + b, 0) / v.length, count: v.length }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);

    return { topAgents, topCategories, highRiskCount: highRisk };
  }, [tickets, riskScoreMap]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Non-FCR Risk Insights</CardTitle>
        <p className="text-xs text-gray-500 mt-1">Top agents and categories by predicted Non-FCR risk and action counts.</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3">
            <p className="text-xs text-slate-500">High-risk tickets</p>
            <p className="text-2xl font-bold text-rose-600 mt-2">{highRiskCount}</p>
            <p className="text-sm text-slate-600 mt-1">Tickets with risk ≥ 70%</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Top agents (avg risk)</p>
            <ul className="mt-2 text-sm space-y-1">
              {topAgents.map(a => (
                <li key={a.id} className="flex justify-between items-center">
                  <div>
                    <div>{getUserById(a.id)?.first_name || `Agent ${a.id}`}</div>
                    <div className="text-xs text-slate-500">{a.count} scored tickets</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{Math.round(a.avg)}%</div>
                    <div className="text-xs text-slate-500">{a.avg >= 70 ? 'Training + Escalation' : a.avg >= 50 ? 'Coaching' : 'Monitor'}</div>
                  </div>
                </li>
              ))}
              {topAgents.length === 0 && <li className="text-xs text-slate-500">No ML scores available</li>}
            </ul>
          </div>
          <div>
            <p className="text-xs text-slate-500">Top categories (avg risk)</p>
            <ul className="mt-2 text-sm space-y-1">
              {topCategories.map(c => (
                <li key={c.id} className="flex justify-between">
                  <span>{getCategoryName(c.id)}</span>
                  <span className="font-semibold">{Math.round(c.avg)}%</span>
                </li>
              ))}
              {topCategories.length === 0 && <li className="text-xs text-slate-500">No ML scores available</li>}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
