import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { TrendingUp, Clock, RefreshCcw, Download } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { calculateKPIs, getTicketsByPriority, getNonFCRTickets, getAssignmentGroupPerformance } from '../../utils/analytics';
import { getAssignmentGroupById, getCategoryById, tickets as seedDataTickets } from '../../data/seedData';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { exportTicketsToCSV } from '../../utils/csvUtils';
import { toast } from 'sonner';
import { WelcomeBanner } from '../../components/WelcomeBanner';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import ManagerDashboard from './ManagerDashboard';
import HRDashboard from './HRDashboard';
import AgentDashboard from './AgentDashboard';
const COLORS = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];
export default function AdminDashboard() {
    const [dashboardView, setDashboardView] = useState('admin');
    const { user } = useAuth();
    const { data: uploadedData } = useData(); // subscribe to uploads to trigger re-render
    const currentTickets = (uploadedData && uploadedData.length > 0) ? uploadedData : seedDataTickets;
    const hasData = currentTickets.length > 0;
    const kpis = calculateKPIs(currentTickets);
    const priorityData = getTicketsByPriority(currentTickets);
    const nonFCRTickets = getNonFCRTickets(currentTickets);
    const groupPerformance = getAssignmentGroupPerformance(currentTickets);
    // Aggregate tickets into weekly counts for the chart
    const ticketsToUse = currentTickets;
    const weeklyMap = {};
    ticketsToUse.forEach((t) => {
        const dateField = t.created_date || t.opened_at;
        if (!dateField)
            return;
        const d = new Date(dateField);
        if (isNaN(d.getTime()))
            return;
        const weekStart = new Date(d);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const key = weekStart.toISOString().split('T')[0];
        weeklyMap[key] = (weeklyMap[key] || 0) + 1;
    });
    const weeklyData = Object.entries(weeklyMap)
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .map(([week, count]) => ({
        week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        tickets: count
    }));
    const groupPerformanceData = groupPerformance.map(g => ({
        name: getAssignmentGroupById(g.groupId)?.group_name || `Group ${g.groupId}`,
        sla: Math.round(g.slaCompliance),
        fcr: Math.round(g.fcrRate),
        tickets: g.totalTickets
    }));
    const handleExport = () => {
        exportTicketsToCSV();
        toast.success('Ticket data exported successfully');
    };
    return (_jsxs("div", { className: "space-y-2", children: [_jsx(WelcomeBanner, { userName: user?.name || 'User', role: "Admin" }), _jsxs(Tabs, { value: dashboardView, onValueChange: setDashboardView, className: "w-full", children: [_jsxs(TabsList, { className: "grid w-full max-w-md grid-cols-4 mb-4", children: [_jsx(TabsTrigger, { value: "admin", children: "Admin" }), _jsx(TabsTrigger, { value: "manager", children: "Manager" }), _jsx(TabsTrigger, { value: "hr", children: "HR" }), _jsx(TabsTrigger, { value: "agent", children: "Agent" })] }), _jsx(TabsContent, { value: "admin", children: _jsx(AdminView, { currentTickets: currentTickets, hasData: hasData, user: user }) }), _jsx(TabsContent, { value: "manager", children: _jsx(ManagerDashboard, {}) }), _jsx(TabsContent, { value: "hr", children: _jsx(HRDashboard, {}) }), _jsx(TabsContent, { value: "agent", children: _jsx(AgentDashboard, { showAgentSelector: true }) })] })] }));
}
function AdminView({ currentTickets, hasData, user }) {
    const kpis = calculateKPIs(currentTickets);
    const priorityData = getTicketsByPriority(currentTickets);
    const nonFCRTickets = getNonFCRTickets(currentTickets);
    const groupPerformance = getAssignmentGroupPerformance(currentTickets);
    // Aggregate tickets into weekly counts for the chart
    const ticketsToUse = currentTickets;
    const weeklyMap = {};
    ticketsToUse.forEach((t) => {
        const dateField = t.created_date || t.opened_at;
        if (!dateField)
            return;
        const d = new Date(dateField);
        if (isNaN(d.getTime()))
            return;
        const weekStart = new Date(d);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const key = weekStart.toISOString().split('T')[0];
        weeklyMap[key] = (weeklyMap[key] || 0) + 1;
    });
    const weeklyData = Object.entries(weeklyMap)
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .map(([week, count]) => ({
        week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        tickets: count
    }));
    const groupPerformanceData = groupPerformance.map(g => ({
        name: getAssignmentGroupById(g.groupId)?.group_name || `Group ${g.groupId}`,
        sla: Math.round(g.slaCompliance),
        fcr: Math.round(g.fcrRate),
        tickets: g.totalTickets
    }));
    const handleExport = () => {
        exportTicketsToCSV();
        toast.success('Ticket data exported successfully');
    };
    return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-gray-900", children: "Admin Dashboard" }), _jsxs("p", { className: "text-xs text-gray-600 mt-0", children: ["Logged in as: ", user?.name || 'Admin', " (", user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Admin', ")"] }), _jsx("p", { className: "text-xs text-gray-600 mt-1", children: "System-wide overview and performance metrics" })] }), _jsxs(Button, { onClick: handleExport, variant: "outline", size: "sm", className: "h-8 text-xs", children: [_jsx(Download, { className: "w-3 h-3 mr-1" }), "Export Data"] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between pb-2 pt-4 px-4", children: [_jsx(CardTitle, { className: "text-sm font-medium text-gray-600", children: "SLA Compliance" }), _jsx(TrendingUp, { className: "w-4 h-4 text-green-600" })] }), _jsxs(CardContent, { className: "pt-2 px-4 pb-4", children: [_jsx("div", { className: "text-2xl font-bold text-gray-900", children: hasData ? `${kpis.slaCompliance.toFixed(1)}%` : 'N/A' }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: hasData ? `${kpis.totalTickets} total tickets` : 'No data' })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between pb-2 pt-4 px-4", children: [_jsx(CardTitle, { className: "text-sm font-medium text-gray-600", children: "FCR Rate" }), _jsx(TrendingUp, { className: "w-4 h-4 text-blue-600" })] }), _jsxs(CardContent, { className: "pt-2 px-4 pb-4", children: [_jsx("div", { className: "text-2xl font-bold text-gray-900", children: hasData ? `${kpis.fcrRate.toFixed(1)}%` : 'N/A' }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "First Contact Resolution" })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between pb-2 pt-4 px-4", children: [_jsx(CardTitle, { className: "text-sm font-medium text-gray-600", children: "Median Resolution Time" }), _jsx(Clock, { className: "w-4 h-4 text-indigo-600" })] }), _jsxs(CardContent, { className: "pt-2 px-4 pb-4", children: [_jsx("div", { className: "text-2xl font-bold text-gray-900", children: hasData ? `${kpis.medianResolutionTime.toFixed(1)}h` : 'N/A' }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: hasData ? `${kpis.resolvedTickets} resolved tickets` : 'No data' })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between pb-2 pt-4 px-4", children: [_jsx(CardTitle, { className: "text-sm font-medium text-gray-600", children: "Reopen Rate" }), _jsx(RefreshCcw, { className: "w-4 h-4 text-orange-600" })] }), _jsxs(CardContent, { className: "pt-2 px-4 pb-4", children: [_jsx("div", { className: "text-2xl font-bold text-gray-900", children: hasData ? `${kpis.reopenRate.toFixed(1)}%` : 'N/A' }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: hasData ? 'Tickets reopened' : 'No data' })] })] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-2", children: [_jsxs(Card, { children: [_jsx(CardHeader, { className: "pt-2 px-2 pb-1", children: _jsx(CardTitle, { className: "text-xs", children: "Weekly Ticket Volume" }) }), _jsx(CardContent, { className: "px-2 pb-2", children: _jsx(ResponsiveContainer, { width: "100%", height: 220, children: _jsxs(LineChart, { data: weeklyData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "week" }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Legend, {}), _jsx(Line, { type: "monotone", dataKey: "tickets", stroke: "#4F46E5", strokeWidth: 2 })] }) }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { className: "pt-2 px-2 pb-1", children: _jsx(CardTitle, { className: "text-xs", children: "Tickets by Priority" }) }), _jsx(CardContent, { className: "px-2 pb-2", children: _jsx(ResponsiveContainer, { width: "100%", height: 250, children: _jsxs(PieChart, { margin: { top: 10, right: 30, bottom: 10, left: 30 }, children: [_jsx(Pie, { data: priorityData, cx: "50%", cy: "50%", labelLine: false, label: ({ priority, percent }) => `${priority}: ${(percent * 100).toFixed(0)}%`, outerRadius: 60, fill: "#8884d8", dataKey: "count", children: priorityData.map((entry, index) => (_jsx(Cell, { fill: COLORS[index % COLORS.length] }, `cell-${index}`))) }), _jsx(Tooltip, {})] }) }) })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { className: "pt-2 px-2 pb-1", children: _jsx(CardTitle, { className: "text-xs", children: "Assignment Group Performance" }) }), _jsx(CardContent, { className: "px-2 pb-2", children: _jsx(ResponsiveContainer, { width: "100%", height: 220, children: _jsxs(BarChart, { data: groupPerformanceData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "name" }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Legend, {}), _jsx(Bar, { dataKey: "sla", fill: "#4F46E5", name: "SLA %" }), _jsx(Bar, { dataKey: "fcr", fill: "#06B6D4", name: "FCR %" })] }) }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Non-FCR Tickets (Priority Order)" }) }), _jsx(CardContent, { children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b", children: [_jsx("th", { className: "text-left p-2 font-medium", children: "Ticket ID" }), _jsx("th", { className: "text-left p-2 font-medium", children: "Priority" }), _jsx("th", { className: "text-left p-2 font-medium", children: "Category" }), _jsx("th", { className: "text-left p-2 font-medium", children: "Opened" }), _jsx("th", { className: "text-left p-2 font-medium", children: "Age (days)" }), _jsx("th", { className: "text-left p-2 font-medium", children: "Reopens" })] }) }), _jsx("tbody", { children: nonFCRTickets.slice(0, 10).map(ticket => {
                                            const age = Math.floor((new Date().getTime() - new Date(ticket.opened_at).getTime()) / (1000 * 60 * 60 * 24));
                                            return (_jsxs("tr", { className: "border-b hover:bg-gray-50", children: [_jsx("td", { className: "p-2 font-mono text-xs", children: ticket.ticket_id }), _jsx("td", { className: "p-2", children: _jsx("span", { className: `px-2 py-1 rounded text-xs ${ticket.priority_code === 'P1' ? 'bg-red-100 text-red-800' :
                                                                ticket.priority_code === 'P2' ? 'bg-orange-100 text-orange-800' :
                                                                    ticket.priority_code === 'P3' ? 'bg-yellow-100 text-yellow-800' :
                                                                        'bg-gray-100 text-gray-800'}`, children: ticket.priority_code }) }), _jsx("td", { className: "p-2", children: getCategoryById(ticket.category_id)?.category_name }), _jsx("td", { className: "p-2", children: new Date(ticket.opened_at).toLocaleDateString() }), _jsx("td", { className: "p-2", children: age }), _jsx("td", { className: "p-2 text-center", children: ticket.reopen_count })] }, ticket.ticket_id));
                                        }) })] }) }) })] })] }));
}
