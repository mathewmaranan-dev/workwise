import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Users, Activity, AlertTriangle, Target } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getNonFCRTickets, getEmployeePerformance } from '../../utils/analytics';
import { predictNonFCRRisk } from '../../utils/mlAlgorithms';
import { tickets as seedDataTickets, getAssignmentGroupById, getCategoryById, getUserById, assignmentGroups, } from '../../data/seedData';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Button } from '../../components/ui/button';
export default function ManagerDashboard() {
    const { user } = useAuth();
    const { data: uploadedData } = useData();
    const [filterStatus, setFilterStatus] = useState('all');
    // Use uploaded data if available; otherwise use seeded data
    const currentTickets = useMemo(() => (uploadedData && uploadedData.length > 0 ? uploadedData : seedDataTickets), [uploadedData]);
    const hasData = currentTickets.length > 0;
    const initialGroupId = user?.assignment_group_id ?? (user?.role === 'manager' ? 1 : 2);
    const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
    const selectedGroup = getAssignmentGroupById(selectedGroupId);
    const selectedGroupTickets = useMemo(() => currentTickets.filter(t => t.assignment_group_id === selectedGroupId), [currentTickets, selectedGroupId]);
    const selectedGroupNonFCRTickets = useMemo(() => getNonFCRTickets(selectedGroupTickets), [selectedGroupTickets]);
    const displayGroupId = selectedGroupId;
    const displayGroup = getAssignmentGroupById(displayGroupId);
    const groupTickets = selectedGroupTickets;
    const groupNonFCRTickets = selectedGroupNonFCRTickets;
    const isFallbackGroup = false;
    // Calculate KPIs for manager's group only
    const groupKPIs = {
        slaCompliance: groupTickets.length > 0
            ? (groupTickets.filter(t => t.made_sla).length / groupTickets.length) * 100
            : 0,
        fcrRate: groupTickets.length > 0
            ? (groupTickets.filter(t => t.fcr).length / groupTickets.length) * 100
            : 0,
        totalTickets: groupTickets.length,
        activeTickets: groupTickets.filter(t => t.status_id !== 3 && t.status_id !== 4).length,
        resolvedTickets: groupTickets.filter(t => t.status_id === 3 || t.status_id === 4).length
    };
    // Task allocation by status
    const newTasks = groupTickets.filter(t => t.status_id === 1).length;
    const openTasks = groupTickets.filter(t => t.status_id === 6).length;
    const assignedTasks = groupTickets.filter(t => t.assigned_to_id && t.status_id === 2).length;
    const pendingTasks = groupTickets.filter(t => t.status_id === 5).length;
    const taskAllocationData = [
        { name: 'New', value: newTasks, color: '#3B82F6' },
        { name: 'Open', value: openTasks, color: '#10B981' },
        { name: 'Assigned', value: assignedTasks, color: '#8B5CF6' },
        { name: 'Pending', value: pendingTasks, color: '#F59E0B' }
    ];
    // Weekly workload for this group (from uploaded data)
    const weeklyGroupData = (() => {
        if (!hasData)
            return [];
        const map = {};
        currentTickets.forEach((t) => {
            if (t.assignment_group_id !== displayGroupId)
                return;
            const d = new Date(t.created_date);
            const wk = new Date(d);
            wk.setDate(wk.getDate() - wk.getDay());
            const key = wk.toISOString().split('T')[0];
            map[key] = (map[key] || 0) + 1;
        });
        return Object.entries(map)
            .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
            .map(([week, count]) => ({ week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), tickets: count }));
    })();
    const [riskScoreMap, setRiskScoreMap] = useState({});
    const [riskLoading, setRiskLoading] = useState(false);
    const [riskError, setRiskError] = useState(null);
    useEffect(() => {
        let isMounted = true;
        const loadRiskScores = async () => {
            if (groupNonFCRTickets.length === 0) {
                setRiskScoreMap({});
                setRiskError(null);
                setRiskLoading(false);
                return;
            }
            setRiskLoading(true);
            setRiskError(null);
            try {
                const scores = await predictNonFCRRisk(groupNonFCRTickets, currentTickets);
                if (!isMounted)
                    return;
                setRiskScoreMap(Object.fromEntries(scores.map(score => [score.ticket_id, score])));
            }
            catch (error) {
                if (!isMounted)
                    return;
                console.warn('Failed to load ML risk scores', error);
                setRiskError('ML scoring unavailable, using fallback heuristics');
            }
            finally {
                if (isMounted) {
                    setRiskLoading(false);
                }
            }
        };
        loadRiskScores();
        return () => {
            isMounted = false;
        };
    }, [groupNonFCRTickets, currentTickets]);
    const computeAgentFcrHistory = (agentId) => {
        const agentTickets = currentTickets.filter(t => t.assigned_to_id === agentId);
        if (agentTickets.length === 0)
            return 0.7;
        return agentTickets.filter(t => t.fcr).length / agentTickets.length;
    };
    const computeCategoryNonFcrRate = (categoryId) => {
        const categoryTickets = currentTickets.filter(t => t.category_id === categoryId);
        if (categoryTickets.length === 0)
            return 0.3;
        return categoryTickets.filter(t => !t.fcr).length / categoryTickets.length;
    };
    // Active tickets based on filter
    let filteredTickets = groupTickets;
    if (filterStatus === 'active') {
        filteredTickets = groupTickets.filter(t => t.status_id !== 3 && t.status_id !== 4);
    }
    else if (filterStatus === 'new') {
        filteredTickets = groupTickets.filter(t => t.status_id === 1);
    }
    else if (filterStatus === 'closed') {
        filteredTickets = groupTickets.filter(t => t.status_id === 3 || t.status_id === 4);
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900", children: "Team Manager Dashboard" }), _jsxs("p", { className: "text-gray-600 mt-1", children: ["Logged in as: ", user?.name || 'Manager', " (", user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Manager', ")"] }), _jsxs("p", { className: "text-gray-600 mt-1", children: ["Viewing tickets for: ", displayGroup?.group_name || `Group ${displayGroupId}`] }), isFallbackGroup && (_jsxs("div", { className: "mt-2 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800", children: ["No non-FCR data exists for the selected team. Showing sample data for ", displayGroup?.group_name || `Group ${displayGroupId}`, " so ML behavior can be validated."] })), _jsx("div", { className: "mt-3 flex flex-wrap gap-3 items-center", children: assignmentGroups.map(group => (_jsx("button", { type: "button", onClick: () => setSelectedGroupId(group.assignment_group_id), className: `rounded-full px-3 py-1 text-xs font-semibold transition ${selectedGroupId === group.assignment_group_id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`, children: group.group_name }, group.assignment_group_id))) })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium text-gray-600", children: "SLA Compliance" }), _jsx(Target, { className: "w-4 h-4 text-green-600" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-3xl font-bold text-gray-900", children: hasData ? `${groupKPIs.slaCompliance.toFixed(1)}%` : 'N/A' }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: hasData ? `${groupKPIs.totalTickets} total tickets` : 'No data' })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium text-gray-600", children: "FCR Rate" }), _jsx(Activity, { className: "w-4 h-4 text-blue-600" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-3xl font-bold text-gray-900", children: hasData ? `${groupKPIs.fcrRate.toFixed(1)}%` : 'N/A' }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "First contact resolution" })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium text-gray-600", children: "Active Tickets" }), _jsx(Users, { className: "w-4 h-4 text-indigo-600" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-3xl font-bold text-gray-900", children: hasData ? groupKPIs.activeTickets : 'N/A' }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Requiring attention" })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium text-gray-600", children: "Non-FCR Alerts" }), _jsx(AlertTriangle, { className: "w-4 h-4 text-orange-600" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-3xl font-bold text-gray-900", children: hasData ? groupNonFCRTickets.length : 'N/A' }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Tickets needing review" })] })] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Task Allocation Overview" }) }), _jsxs(CardContent, { children: [_jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(PieChart, { children: [_jsx(Pie, { data: taskAllocationData, cx: "50%", cy: "50%", labelLine: false, label: ({ name, value }) => `${name}: ${value}`, outerRadius: 100, fill: "#8884d8", dataKey: "value", children: taskAllocationData.map((entry, index) => (_jsx(Cell, { fill: entry.color }, `cell-${index}`))) }), _jsx(Tooltip, {})] }) }), _jsxs("div", { className: "grid grid-cols-3 gap-4 mt-4", children: [_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-blue-600", children: newTasks }), _jsx("p", { className: "text-xs text-gray-500", children: "New Tasks" })] }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-purple-600", children: assignedTasks }), _jsx("p", { className: "text-xs text-gray-500", children: "Assigned" })] }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-amber-600", children: pendingTasks }), _jsx("p", { className: "text-xs text-gray-500", children: "Pending" })] })] })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Weekly Workload Trend" }) }), _jsx(CardContent, { children: _jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(LineChart, { data: weeklyGroupData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "week" }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Legend, {}), _jsx(Line, { type: "monotone", dataKey: "tickets", stroke: "#4F46E5", strokeWidth: 2, name: "Weekly Tickets" })] }) }) })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Non-FCR Detection List - Action Required" }), _jsxs("p", { className: "text-xs text-gray-500 mt-1", children: ["Tickets requiring follow-up or escalation", riskLoading ? ' · Loading ML scores…' : riskError ? ` · ${riskError}` : ''] })] }), _jsx(CardContent, { children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b bg-gray-50", children: [_jsx("th", { className: "text-left p-3 font-medium", children: "Ticket ID" }), _jsx("th", { className: "text-left p-3 font-medium", children: "Priority" }), _jsx("th", { className: "text-left p-3 font-medium", children: "Category" }), _jsx("th", { className: "text-left p-3 font-medium", children: "Status" }), _jsx("th", { className: "text-left p-3 font-medium", children: "Risk" }), _jsx("th", { className: "text-left p-3 font-medium", children: "Action" }), _jsx("th", { className: "text-left p-3 font-medium", children: "Age (days)" }), _jsx("th", { className: "text-left p-3 font-medium", children: "Reopens" })] }) }), _jsx("tbody", { children: groupNonFCRTickets.length === 0 ? (_jsx("tr", { className: "border-b hover:bg-gray-50", children: _jsx("td", { className: "p-3 text-sm text-gray-500", colSpan: 8, children: "No non-FCR tickets found for this team. Check that the manager is assigned to a valid group and that ticket data is loaded." }) })) : groupNonFCRTickets.slice(0, 10).map(ticket => {
                                            const age = Math.floor((new Date().getTime() - new Date(ticket.created_date).getTime()) / (1000 * 60 * 60 * 24));
                                            const fullTicket = groupTickets.find(t => t.ticket_id === ticket.ticket_id);
                                            return (_jsxs("tr", { className: "border-b hover:bg-gray-50", children: [_jsx("td", { className: "p-3 font-mono text-xs font-medium", children: ticket.ticket_id }), _jsx("td", { className: "p-3", children: _jsxs("span", { className: `px-2 py-1 rounded text-xs font-medium ${ticket.priority_id === 1 ? 'bg-red-100 text-red-800' :
                                                                ticket.priority_id === 2 ? 'bg-orange-100 text-orange-800' :
                                                                    ticket.priority_id === 3 ? 'bg-yellow-100 text-yellow-800' :
                                                                        'bg-gray-100 text-gray-800'}`, children: ["P", ticket.priority_id] }) }), _jsx("td", { className: "p-3", children: getCategoryById(ticket.category_id)?.category_name }), _jsxs("td", { className: "p-3 text-xs", children: [fullTicket?.status_id === 1 && 'New', fullTicket?.status_id === 2 && 'In Progress', fullTicket?.status_id === 3 && 'Resolved', fullTicket?.status_id === 4 && 'Closed', fullTicket?.status_id === 5 && 'On Hold'] }), _jsx("td", { className: "p-3", children: riskScoreMap[ticket.ticket_id] ? (_jsxs("span", { className: `px-2 py-1 rounded text-xs font-semibold ${riskScoreMap[ticket.ticket_id].riskScore >= 70 ? 'bg-red-100 text-red-800' :
                                                                riskScoreMap[ticket.ticket_id].riskScore >= 50 ? 'bg-orange-100 text-orange-800' :
                                                                    'bg-amber-100 text-amber-800'}`, children: [riskScoreMap[ticket.ticket_id].riskScore, "%"] })) : 'N/A' }), _jsx("td", { className: "p-3 text-sm text-slate-700", children: riskScoreMap[ticket.ticket_id]?.recommendation ?? 'Monitor ticket' }), _jsxs("td", { className: "p-3", children: [age, "d"] }), _jsx("td", { className: "p-3 text-center", children: (fullTicket?.reopen_count ?? 0) > 0 && (_jsx("span", { className: "bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium", children: fullTicket?.reopen_count })) })] }, ticket.ticket_id));
                                        }) })] }) }) })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Agent First Contact Resolution (FCR) Performance" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Agents by FCR rate - identify training needs" })] }), _jsx(CardContent, { children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b bg-gray-50", children: [_jsx("th", { className: "text-left p-3 font-medium", children: "Agent" }), _jsx("th", { className: "text-left p-3 font-medium", children: "Tickets Resolved" }), _jsx("th", { className: "text-left p-3 font-medium", children: "FCR Rate" }), _jsx("th", { className: "text-left p-3 font-medium", children: "FCR Count" }), _jsx("th", { className: "text-left p-3 font-medium", children: "Non-FCR" })] }) }), _jsx("tbody", { children: getEmployeePerformance(currentTickets)
                                            .sort((a, b) => b.ticketsResolved - a.ticketsResolved)
                                            .slice(0, 10)
                                            .map(agent => {
                                            const agentTickets = currentTickets.filter(t => t.assigned_to_id === agent.userId);
                                            const fcrCount = agentTickets.filter(t => t.fcr === true).length;
                                            const nonFcrCount = agentTickets.filter(t => t.fcr === false).length;
                                            const user = getUserById(agent.userId);
                                            const fcrColor = agent.fcrRate >= 80 ? 'text-green-600' : agent.fcrRate >= 60 ? 'text-yellow-600' : 'text-red-600';
                                            return (_jsxs("tr", { className: "border-b hover:bg-gray-50", children: [_jsxs("td", { className: "p-3 font-medium", children: [user?.first_name, " ", user?.last_name] }), _jsx("td", { className: "p-3", children: agent.ticketsResolved }), _jsxs("td", { className: `p-3 font-bold ${fcrColor}`, children: [agent.fcrRate.toFixed(1), "%"] }), _jsx("td", { className: "p-3 text-green-600", children: fcrCount }), _jsx("td", { className: "p-3 text-red-600", children: nonFcrCount > 0 ? nonFcrCount : '—' })] }, agent.userId));
                                        }) })] }) }) })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between", children: [_jsx(CardTitle, { children: "Active Tickets" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { size: "sm", variant: filterStatus === 'all' ? 'default' : 'outline', onClick: () => setFilterStatus('all'), children: "All" }), _jsxs(Button, { size: "sm", variant: filterStatus === 'new' ? 'default' : 'outline', onClick: () => setFilterStatus('new'), children: ["New (", newTasks, ")"] }), _jsxs(Button, { size: "sm", variant: filterStatus === 'active' ? 'default' : 'outline', onClick: () => setFilterStatus('active'), children: ["Active (", groupKPIs.activeTickets, ")"] }), _jsx(Button, { size: "sm", variant: filterStatus === 'closed' ? 'default' : 'outline', onClick: () => setFilterStatus('closed'), children: "Closed" })] })] }), _jsx(CardContent, { children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b bg-gray-50", children: [_jsx("th", { className: "text-left p-3 font-medium", children: "Ticket ID" }), _jsx("th", { className: "text-left p-3 font-medium", children: "Description" }), _jsx("th", { className: "text-left p-3 font-medium", children: "Status" }), _jsx("th", { className: "text-left p-3 font-medium", children: "Priority" }), _jsx("th", { className: "text-left p-3 font-medium", children: "Created" })] }) }), _jsx("tbody", { children: filteredTickets.slice(0, 15).map(ticket => (_jsxs("tr", { className: "border-b hover:bg-gray-50", children: [_jsx("td", { className: "p-3 font-mono text-xs font-medium", children: ticket.ticket_id }), _jsx("td", { className: "p-3 truncate max-w-xs", children: ticket.short_description }), _jsx("td", { className: "p-3 text-xs", children: _jsxs("span", { className: `px-2 py-1 rounded text-xs ${ticket.status_id === 1 ? 'bg-blue-100 text-blue-800' :
                                                            ticket.status_id === 2 ? 'bg-purple-100 text-purple-800' :
                                                                ticket.status_id === 3 ? 'bg-green-100 text-green-800' :
                                                                    ticket.status_id === 4 ? 'bg-gray-100 text-gray-800' :
                                                                        'bg-amber-100 text-amber-800'}`, children: [ticket.status_id === 1 && 'New', ticket.status_id === 2 && 'In Progress', ticket.status_id === 3 && 'Resolved', ticket.status_id === 4 && 'Closed', ticket.status_id === 5 && 'Pending'] }) }), _jsx("td", { className: "p-3", children: _jsxs("span", { className: `px-2 py-1 rounded text-xs font-medium ${ticket.priority_id === 1 ? 'bg-red-100 text-red-800' :
                                                            ticket.priority_id === 2 ? 'bg-orange-100 text-orange-800' :
                                                                ticket.priority_id === 3 ? 'bg-yellow-100 text-yellow-800' :
                                                                    'bg-gray-100 text-gray-800'}`, children: ["P", ticket.priority_id] }) }), _jsx("td", { className: "p-3 text-xs", children: new Date(ticket.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })] }, ticket.ticket_id))) })] }) }) })] })] }));
}
