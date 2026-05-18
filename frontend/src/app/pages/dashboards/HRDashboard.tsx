import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Users, TrendingUp, Award, AlertCircle, TrendingDown } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  calculateKPIs, 
  getAssignmentGroupPerformance, 
  calculateEmployeeSatisfaction, 
  calculateProductivityTrend,
  getOptimizationNeeds 
} from '../../utils/analytics';
import { weeklyCounts, getAssignmentGroupById, assignmentGroups, tickets as seedDataTickets } from '../../data/seedData';
import { useData } from '../../context/DataContext';

export default function HRDashboard() {
  const { data: uploadedData } = useData();
  const currentTickets = (uploadedData && uploadedData.length > 0) ? uploadedData : seedDataTickets;
  const hasData = currentTickets.length > 0;

  const kpis = calculateKPIs(currentTickets);
  const groupPerformance = getAssignmentGroupPerformance(currentTickets);
  const employeeSatisfaction = calculateEmployeeSatisfaction(currentTickets);
  const productivityTrend = calculateProductivityTrend(currentTickets);
  const optimizationNeeds = getOptimizationNeeds(currentTickets);

  const weeklyData = hasData
    ? (() => {
        const map: Record<string, number> = {};
        currentTickets.forEach((t: any) => {
          const d = new Date(t.created_date || t.opened_at);
          if (isNaN(d.getTime())) return;
          const wk = new Date(d);
          wk.setDate(wk.getDate() - wk.getDay());
          const key = wk.toISOString().split('T')[0];
          map[key] = (map[key] || 0) + 1;
        });
        return Object.entries(map)
          .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
          .map(([week, count]) => ({ week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), tickets: count }));
      })()
    : weeklyCounts.map(w => ({
        week: new Date(w.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        tickets: w.ticket_count
      }));

  // Get top and bottom performing groups
  const performanceScores = groupPerformance.map(g => ({
    ...g,
    teamName: getAssignmentGroupById(g.groupId)?.group_name || `Group ${g.groupId}`,
    overallScore: (g.slaCompliance + g.fcrRate) / 2
  }));

  const topPerformers = [...performanceScores]
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, 5);

  const underperformers = [...performanceScores]
    .filter(g => g.overallScore < 75)
    .sort((a, b) => a.overallScore - b.overallScore);

  // Dynamic recommendations based on data
  const generateRecommendations = () => {
    const recs = [];
    
    if (optimizationNeeds.needsMoreStaff) {
      recs.push({
        category: 'Resource Allocation',
        action: `Increase staffing - SLA compliance at ${kpis.slaCompliance.toFixed(1)}%`,
        impact: 'Target: Increase SLA compliance to 90%+',
        priority: 'High'
      });
    }
    
    if (optimizationNeeds.needsTraining) {
      const lowFCRGroup = underperformers[0];
      recs.push({
        category: 'Training',
        action: `Implement troubleshooting workshop for ${lowFCRGroup?.teamName || 'teams'}`,
        impact: `Expected 5-15% improvement in FCR rate (currently ${kpis.fcrRate.toFixed(1)}%)`,
        priority: 'High'
      });
    }
    
    if (optimizationNeeds.needsProcessReview) {
      recs.push({
        category: 'Process Improvement',
        action: 'Review ticket triage and escalation procedures',
        impact: `Reduce reopen rate from ${kpis.reopenRate.toFixed(1)}% to <5%`,
        priority: 'Medium'
      });
    }
    
    if (productivityTrend < 0) {
      recs.push({
        category: 'Workload Analysis',
        action: 'Analyze declining productivity trend',
        impact: `Current trend: ${productivityTrend.toFixed(1)}% - investigate root causes`,
        priority: 'High'
      });
    }
    
    // Ensure we have at least some recommendations
    if (recs.length === 0) {
      recs.push(
        {
          category: 'Continuous Improvement',
          action: 'Maintain current performance levels',
          impact: 'Continue monitoring team metrics',
          priority: 'Medium'
        },
        {
          category: 'Knowledge Management',
          action: 'Expand knowledge base and documentation',
          impact: 'Support team efficiency and reduce resolution time',
          priority: 'Medium'
        }
      );
    }
    
    return recs;
  };

  const recommendations = generateRecommendations();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">HR & Senior Management Dashboard</h1>
        <p className="text-gray-600 mt-1">Organizational performance, team health, and strategic insights</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Overall Performance</CardTitle>
            <Award className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {((kpis.slaCompliance + kpis.fcrRate) / 2).toFixed(1)}%
            </div>
            <p className="text-xs text-gray-500 mt-1">Composite score (SLA + FCR)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Employee Satisfaction</CardTitle>
            <Users className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{employeeSatisfaction.toFixed(1)}/5.0</div>
            <p className="text-xs text-gray-500 mt-1">Based on performance metrics</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Productivity Trend</CardTitle>
            <TrendingUp className={`w-4 h-4 ${productivityTrend >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${productivityTrend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {productivityTrend >= 0 ? '+' : ''}{productivityTrend.toFixed(1)}%
            </div>
            <p className="text-xs text-gray-500 mt-1">vs. previous period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Teams Needing Support</CardTitle>
            <AlertCircle className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{underperformers.length}</div>
            <p className="text-xs text-gray-500 mt-1">Teams with score &lt;75%</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Organizational Workload Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="tickets" stroke="#4F46E5" strokeWidth={2} name="Weekly Volume" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Performing Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart 
                data={topPerformers.map(g => ({ name: g.teamName, performance: g.overallScore }))} 
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="name" type="category" width={140} />
                <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
                <Bar dataKey="performance" fill="#10B981" name="Performance Score" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Underperforming Teams Alert */}
      {underperformers.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-orange-600" />
              <CardTitle>Teams Requiring Immediate Attention</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {underperformers.map(group => (
                <div key={group.groupId} className="border rounded p-3 bg-white">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">{group.teamName}</h4>
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
                      Score: {group.overallScore.toFixed(1)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">SLA Compliance</p>
                      <p className="font-medium">{group.slaCompliance.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">FCR Rate</p>
                      <p className="font-medium">{group.fcrRate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Avg Resolution</p>
                      <p className="font-medium">{group.avgResolutionTime.toFixed(1)}h</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Complete Team Performance Summary</CardTitle>
          <p className="text-xs text-gray-500 mt-1">All teams ranked by overall performance score</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Team Name</th>
                  <th className="text-left p-3 font-medium">Workload</th>
                  <th className="text-left p-3 font-medium">SLA</th>
                  <th className="text-left p-3 font-medium">FCR</th>
                  <th className="text-left p-3 font-medium">Avg Resolution</th>
                  <th className="text-left p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {performanceScores
                  .sort((a, b) => b.overallScore - a.overallScore)
                  .map(group => {
                    const status = group.overallScore >= 80 ? 'Excellent' : 
                                   group.overallScore >= 70 ? 'Good' : 'Needs Support';
                    return (
                      <tr key={group.groupId} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{group.teamName}</td>
                        <td className="p-3">{group.totalTickets} tickets</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            group.slaCompliance >= 90 ? 'bg-green-100 text-green-800' :
                            group.slaCompliance >= 80 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {group.slaCompliance.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            group.fcrRate >= 75 ? 'bg-green-100 text-green-800' :
                            group.fcrRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {group.fcrRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-3">{group.avgResolutionTime.toFixed(1)}h</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            status === 'Excellent' ? 'bg-green-100 text-green-800' :
                            status === 'Good' ? 'bg-blue-100 text-blue-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recommended Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Strategic Actions</CardTitle>
          <p className="text-xs text-gray-500 mt-1">Data-driven recommendations for organizational improvement</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recommendations.map((rec, index) => (
              <div key={index} className="border rounded-lg p-4 hover:border-indigo-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-medium text-gray-900">{rec.category}</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        rec.priority === 'High' ? 'bg-red-100 text-red-800' :
                        rec.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {rec.priority} Priority
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-1">{rec.action}</p>
                    <p className="text-xs text-gray-500">{rec.impact}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
