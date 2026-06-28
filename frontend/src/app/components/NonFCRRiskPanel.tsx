import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useLookupData } from '../hooks/useLookupData';
import { getUserById } from '../data/seedData';

interface Props {
  tickets: any[];
  riskScoreMap: Record<string, any>;
}

interface CategoryAnalysis {
  id: number;
  name: string;
  avgRisk: number;
  count: number;
  fcrRate: number;
  uniqueAgents: number;
  problemType: 'category-wide' | 'agent-specific' | 'mixed';
  recommendation: string;
}

export default function NonFCRRiskPanel({ tickets, riskScoreMap }: Props) {
  const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';
  const { getCategoryName } = useLookupData(apiBase);
  const { topAgents, categoryAnalysis, highRiskCount } = useMemo(() => {
    const agentMap: Record<number, number[]> = {};
    const categoryDetailMap: Record<number, { scores: number[], agents: Set<number>, fcrTickets: number, totalTickets: number }> = {};
    let highRisk = 0;

    tickets.forEach((t) => {
      if (!t || typeof t !== 'object') return;
      const scoreEntry = riskScoreMap[t.ticket_id];
      const score = scoreEntry?.riskScore ?? null;
      if (score !== null) {
        if (!agentMap[t.assigned_to_id]) agentMap[t.assigned_to_id] = [];
        agentMap[t.assigned_to_id].push(score);

        if (!categoryDetailMap[t.category_id]) {
          categoryDetailMap[t.category_id] = { scores: [], agents: new Set(), fcrTickets: 0, totalTickets: 0 };
        }
        categoryDetailMap[t.category_id].scores.push(score);
        categoryDetailMap[t.category_id].agents.add(t.assigned_to_id);
        
        // Calculate FCR: ticket is FCR if it has 0 reopens OR fcr flag is true
        const isFCR = (t.reopen_count === 0 || t.reopen_count === '0') || t.fcr === true;
        if (isFCR) categoryDetailMap[t.category_id].fcrTickets += 1;
        categoryDetailMap[t.category_id].totalTickets += 1;

        if (score >= 70) highRisk += 1;
      }
    });

    const topAgents = Object.entries(agentMap)
      .map(([k, v]) => ({ id: Number(k), avg: v.reduce((a, b) => a + b, 0) / v.length, count: v.length }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);

    // Analyze categories for problem type and recommendations
    const categoryAnalysis: CategoryAnalysis[] = Object.entries(categoryDetailMap)
      .map(([catId, data]) => {
        const avgRisk = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        const fcrRate = (data.fcrTickets / data.totalTickets) * 100;
        const uniqueAgents = data.agents.size;
        
        // Determine problem type
        let problemType: 'category-wide' | 'agent-specific' | 'mixed' = 'agent-specific';
        if (uniqueAgents >= 3) {
          problemType = 'category-wide'; // Multiple agents, consistent high risk
        } else if (uniqueAgents >= 2) {
          problemType = 'mixed'; // Some agents handle it well, others don't
        }

        // Generate recommendation based on FCR rate
        let recommendation = '';
        if (fcrRate < 40) {
          recommendation = 'Needs training + process review';
        } else if (fcrRate < 60) {
          recommendation = 'Needs coaching + documentation';
        } else {
          recommendation = 'Monitor';
        }

        return {
          id: Number(catId),
          name: getCategoryName(Number(catId)),
          avgRisk,
          count: data.totalTickets,
          fcrRate,
          uniqueAgents,
          problemType,
          recommendation,
        };
      })
      .sort((a, b) => b.avgRisk - a.avgRisk)
      .slice(0, 5);

    return { topAgents, categoryAnalysis, highRiskCount: highRisk };
  }, [tickets, riskScoreMap, getCategoryName]);

  const getProblemTypeColor = (problemType: string) => {
    if (problemType === 'category-wide') return 'text-red-600 bg-red-50';
    if (problemType === 'mixed') return 'text-amber-600 bg-amber-50';
    return 'text-blue-600 bg-blue-50';
  };

  const getProblemTypeLabel = (problemType: string) => {
    if (problemType === 'category-wide') return '📊 Category-Wide Issue';
    if (problemType === 'mixed') return '⚠️ Mixed Problem';
    return '👤 Agent-Specific';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Non-FCR Risk Insights</CardTitle>
        <p className="text-xs text-gray-500 mt-1">Agent problems, category issues, and actionable recommendations.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Summary Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b">
          <div className="p-3 bg-slate-50 rounded">
            <p className="text-xs text-slate-500">High-risk tickets</p>
            <p className="text-2xl font-bold text-rose-600 mt-2">{highRiskCount}</p>
            <p className="text-sm text-slate-600 mt-1">Risk ≥ 70%</p>
          </div>
          <div className="p-3 bg-slate-50 rounded">
            <p className="text-xs text-slate-500">Total categories analyzed</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">{categoryAnalysis.length}</p>
            <p className="text-sm text-slate-600 mt-1">Problem categories</p>
          </div>
          <div className="p-3 bg-slate-50 rounded">
            <p className="text-xs text-slate-500">Problem distribution</p>
            <p className="text-lg font-bold text-slate-700 mt-2">
              {categoryAnalysis.filter(c => c.problemType === 'category-wide').length} Category-wide
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {categoryAnalysis.filter(c => c.problemType === 'agent-specific').length} Agent-specific
            </p>
          </div>
        </div>

        {/* Agent Problems */}
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-3">👤 Agent Problems</p>
          <div className="space-y-2">
            {topAgents.length === 0 ? (
              <p className="text-xs text-slate-500">No ML scores available</p>
            ) : (
              topAgents.map(a => (
                <div key={a.id} className="flex justify-between items-center p-3 bg-blue-50 rounded border border-blue-200">
                  <div>
                    <div className="font-medium text-sm">{getUserById(a.id)?.first_name || `Agent ${a.id}`}</div>
                    <div className="text-xs text-slate-500">{a.count} high-risk tickets</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-600">{Math.round(a.avg)}% risk</div>
                    <div className="text-xs text-slate-600">
                      {a.avg >= 70 ? '🔴 Training + Escalation' : a.avg >= 50 ? '🟡 Coaching' : '🟢 Monitor'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Category Problems */}
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-3">📊 Category Problems & Recommendations</p>
          <div className="space-y-3">
            {categoryAnalysis.length === 0 ? (
              <p className="text-xs text-slate-500">No category data available</p>
            ) : (
              categoryAnalysis.map(cat => (
                <div key={cat.id} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-sm">{cat.name}</h4>
                      <div className="flex gap-2 mt-1">
                        <span className={`text-xs px-2 py-1 rounded ${getProblemTypeColor(cat.problemType)}`}>
                          {getProblemTypeLabel(cat.problemType)}
                        </span>
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                          {cat.count} tickets • {cat.uniqueAgents} agent{cat.uniqueAgents > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-slate-700">{Math.round(cat.avgRisk)}%</div>
                      <div className="text-xs text-slate-500">avg risk</div>
                    </div>
                  </div>
                  <div className="bg-white border-t pt-2 mt-2 flex justify-between items-center">
                    <div className="flex-1">
                      <div className="text-xs text-slate-600 mb-1">FCR Rate:</div>
                      <div className="text-sm font-semibold">
                        <span className={cat.fcrRate >= 60 ? 'text-green-600' : cat.fcrRate >= 40 ? 'text-amber-600' : 'text-red-600'}>
                          {Math.round(cat.fcrRate)}%
                        </span>
                        <span className="text-xs text-slate-500 ml-1">({cat.fcrRate >= 60 ? '✓ Good' : cat.fcrRate >= 40 ? '⚠️ Fair' : '✗ Poor'})</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-slate-600 mb-1">Action:</div>
                      <div className="text-sm font-semibold text-blue-600">{cat.recommendation}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
