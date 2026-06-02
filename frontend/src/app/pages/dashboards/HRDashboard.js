import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Users, TrendingUp, Award, AlertCircle, TrendingDown } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { calculateKPIs, getAssignmentGroupPerformance, calculateEmployeeSatisfaction, calculateProductivityTrend, getOptimizationNeeds } from '../../utils/analytics';
import { weeklyCounts, getAssignmentGroupById, tickets as seedDataTickets } from '../../data/seedData';
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
            const map = {};
            currentTickets.forEach((t) => {
                const d = new Date(t.created_date || t.opened_at);
                if (isNaN(d.getTime()))
                    return;
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
            recs.push({
                category: 'Continuous Improvement',
                action: 'Maintain current performance levels',
                impact: 'Continue monitoring team metrics',
                priority: 'Medium'
            }, {
                category: 'Knowledge Management',
                action: 'Expand knowledge base and documentation',
                impact: 'Support team efficiency and reduce resolution time',
                priority: 'Medium'
            });
        }
        return recs;
    };
    const recommendations = generateRecommendations();
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900", children: "HR & Senior Management Dashboard" }), _jsx("p", { className: "text-gray-600 mt-1", children: "Organizational performance, team health, and strategic insights" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium text-gray-600", children: "Overall Performance" }), _jsx(Award, { className: "w-4 h-4 text-green-600" })] }), _jsxs(CardContent, { children: [_jsxs("div", { className: "text-3xl font-bold text-gray-900", children: [((kpis.slaCompliance + kpis.fcrRate) / 2).toFixed(1), "%"] }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Composite score (SLA + FCR)" })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium text-gray-600", children: "Employee Satisfaction" }), _jsx(Users, { className: "w-4 h-4 text-blue-600" })] }), _jsxs(CardContent, { children: [_jsxs("div", { className: "text-3xl font-bold text-gray-900", children: [employeeSatisfaction.toFixed(1), "/5.0"] }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Based on performance metrics" })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium text-gray-600", children: "Productivity Trend" }), _jsx(TrendingUp, { className: `w-4 h-4 ${productivityTrend >= 0 ? 'text-green-600' : 'text-red-600'}` })] }), _jsxs(CardContent, { children: [_jsxs("div", { className: `text-3xl font-bold ${productivityTrend >= 0 ? 'text-green-600' : 'text-red-600'}`, children: [productivityTrend >= 0 ? '+' : '', productivityTrend.toFixed(1), "%"] }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "vs. previous period" })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium text-gray-600", children: "Teams Needing Support" }), _jsx(AlertCircle, { className: "w-4 h-4 text-orange-600" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-3xl font-bold text-gray-900", children: underperformers.length }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Teams with score <75%" })] })] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Organizational Workload Trend" }) }), _jsx(CardContent, { children: _jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(LineChart, { data: weeklyData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "week" }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Legend, {}), _jsx(Line, { type: "monotone", dataKey: "tickets", stroke: "#4F46E5", strokeWidth: 2, name: "Weekly Volume" })] }) }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Top Performing Teams" }) }), _jsx(CardContent, { children: _jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(BarChart, { data: topPerformers.map(g => ({ name: g.teamName, performance: g.overallScore })), layout: "vertical", children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { type: "number", domain: [0, 100] }), _jsx(YAxis, { dataKey: "name", type: "category", width: 140 }), _jsx(Tooltip, { formatter: (value) => `${value.toFixed(1)}%` }), _jsx(Bar, { dataKey: "performance", fill: "#10B981", name: "Performance Score" })] }) }) })] })] }), underperformers.length > 0 && (_jsxs(Card, { className: "border-orange-200 bg-orange-50", children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(TrendingDown, { className: "w-5 h-5 text-orange-600" }), _jsx(CardTitle, { children: "Teams Requiring Immediate Attention" })] }) }), _jsx(CardContent, { children: _jsx("div", { className: "space-y-3", children: underperformers.map(group => (_jsxs("div", { className: "border rounded p-3 bg-white", children: [_jsxs("div", { className: "flex justify-between items-start mb-2", children: [_jsx("h4", { className: "font-medium text-gray-900", children: group.teamName }), _jsxs("span", { className: "bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium", children: ["Score: ", group.overallScore.toFixed(1), "%"] })] }), _jsxs("div", { className: "grid grid-cols-3 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-gray-500", children: "SLA Compliance" }), _jsxs("p", { className: "font-medium", children: [group.slaCompliance.toFixed(1), "%"] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-gray-500", children: "FCR Rate" }), _jsxs("p", { className: "font-medium", children: [group.fcrRate.toFixed(1), "%"] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-gray-500", children: "Avg Resolution" }), _jsxs("p", { className: "font-medium", children: [group.avgResolutionTime.toFixed(1), "h"] })] })] })] }, group.groupId))) }) })] })), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Complete Team Performance Summary" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "All teams ranked by overall performance score" })] }), _jsx(CardContent, { children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b bg-gray-50", children: [_jsx("th", { className: "text-left p-3 font-medium", children: "Team Name" }), _jsx("th", { className: "text-left p-3 font-medium", children: "Workload" }), _jsx("th", { className: "text-left p-3 font-medium", children: "SLA" }), _jsx("th", { className: "text-left p-3 font-medium", children: "FCR" }), _jsx("th", { className: "text-left p-3 font-medium", children: "Avg Resolution" }), _jsx("th", { className: "text-left p-3 font-medium", children: "Status" })] }) }), _jsx("tbody", { children: performanceScores
                                            .sort((a, b) => b.overallScore - a.overallScore)
                                            .map(group => {
                                            const status = group.overallScore >= 80 ? 'Excellent' :
                                                group.overallScore >= 70 ? 'Good' : 'Needs Support';
                                            return (_jsxs("tr", { className: "border-b hover:bg-gray-50", children: [_jsx("td", { className: "p-3 font-medium", children: group.teamName }), _jsxs("td", { className: "p-3", children: [group.totalTickets, " tickets"] }), _jsx("td", { className: "p-3", children: _jsxs("span", { className: `px-2 py-1 rounded text-xs font-medium ${group.slaCompliance >= 90 ? 'bg-green-100 text-green-800' :
                                                                group.slaCompliance >= 80 ? 'bg-yellow-100 text-yellow-800' :
                                                                    'bg-red-100 text-red-800'}`, children: [group.slaCompliance.toFixed(1), "%"] }) }), _jsx("td", { className: "p-3", children: _jsxs("span", { className: `px-2 py-1 rounded text-xs font-medium ${group.fcrRate >= 75 ? 'bg-green-100 text-green-800' :
                                                                group.fcrRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                                                    'bg-red-100 text-red-800'}`, children: [group.fcrRate.toFixed(1), "%"] }) }), _jsxs("td", { className: "p-3", children: [group.avgResolutionTime.toFixed(1), "h"] }), _jsx("td", { className: "p-3", children: _jsx("span", { className: `px-2 py-1 rounded text-xs font-medium ${status === 'Excellent' ? 'bg-green-100 text-green-800' :
                                                                status === 'Good' ? 'bg-blue-100 text-blue-800' :
                                                                    'bg-orange-100 text-orange-800'}`, children: status }) })] }, group.groupId));
                                        }) })] }) }) })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Recommended Strategic Actions" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Data-driven recommendations for organizational improvement" })] }), _jsx(CardContent, { children: _jsx("div", { className: "space-y-3", children: recommendations.map((rec, index) => (_jsx("div", { className: "border rounded-lg p-4 hover:border-indigo-300 transition-colors", children: _jsx("div", { className: "flex items-start justify-between", children: _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center gap-3 mb-2", children: [_jsx("span", { className: "font-medium text-gray-900", children: rec.category }), _jsxs("span", { className: `px-2 py-1 rounded text-xs font-medium ${rec.priority === 'High' ? 'bg-red-100 text-red-800' :
                                                            rec.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                                                'bg-gray-100 text-gray-800'}`, children: [rec.priority, " Priority"] })] }), _jsx("p", { className: "text-sm text-gray-700 mb-1", children: rec.action }), _jsx("p", { className: "text-xs text-gray-500", children: rec.impact })] }) }) }, index))) }) })] })] }));
}
