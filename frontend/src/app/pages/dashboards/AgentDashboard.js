import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { ListTodo, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { tickets as seedDataTickets } from '../../data/seedData';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
const COLORS = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
export default function AgentDashboard({ showAgentSelector = false }) {
    const { user, users: authUsers } = useAuth();
    const { data: uploadedData } = useData();
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [backendTickets, setBackendTickets] = useState(null);
    const [loadingTickets, setLoadingTickets] = useState(false);
    const apiBase = import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL || '';
    const token = typeof window !== 'undefined' ? localStorage.getItem('workwise_token') : null;
    // Use backend tickets if loaded, otherwise use uploaded or seed data.
    const currentTickets = backendTickets !== null
        ? backendTickets
        : (uploadedData && uploadedData.length > 0) ? uploadedData : seedDataTickets;
    // Get all agents from backend users
    const agents = authUsers.filter(u => u.role === 'agent');
    const [selectedAgent, setSelectedAgent] = useState(showAgentSelector ? (agents[0]?.id ? parseInt(agents[0].id, 10) : null) : null);
    const currentUserId = user ? parseInt(user.id, 10) : null;
    useEffect(() => {
        if (showAgentSelector && selectedAgent === null && agents.length > 0) {
            setSelectedAgent(parseInt(agents[0].id, 10));
        }
    }, [showAgentSelector, selectedAgent, agents]);
    const currentAgent = showAgentSelector
        ? selectedAgent !== null ? agents.find(a => parseInt(a.id, 10) === selectedAgent) : null
        : (user?.role === 'agent' && currentUserId !== null)
            ? { user_id: currentUserId, first_name: user.first_name || '', last_name: user.last_name || '', email: user.email }
            : null;
    const getStatusId = (ticket) => {
        if (ticket?.status) {
            const statusText = String(ticket.status || ticket.status_name || '').toLowerCase();
            const statusMap = {
                'resolved': 3,
                'closed': 4,
                'in progress': 2,
                'on hold': 5,
                'open': 6,
                'new': 1
            };
            return statusMap[statusText] || 1;
        }
        if (ticket?.status_id !== undefined && ticket?.status_id !== null) {
            return Number(ticket.status_id);
        }
        return 1;
    };
    const isResolvedOrClosed = (ticket) => {
        if (ticket?.status) {
            const statusId = getStatusId(ticket);
            return statusId === 3 || statusId === 4;
        }
        return Number(ticket?.status_id) === 3;
    };
    const getPriorityLabel = (ticket) => {
        if (ticket?.priority)
            return ticket.priority;
        const map = {
            1: 'Low',
            2: 'Medium',
            3: 'High',
            4: 'Critical'
        };
        return map[Number(ticket?.priority_id)] || 'Unknown';
    };
    const getCategoryLabel = (ticket) => {
        if (ticket?.category)
            return ticket.category;
        const map = {
            1: 'Password',
            2: 'Server',
            3: 'Network',
            4: 'Software',
            5: 'Hardware'
        };
        return map[Number(ticket?.category_id)] || 'Uncategorized';
    };
    useEffect(() => {
        if (!apiBase || !user || user.role !== 'agent' || !token)
            return;
        setLoadingTickets(true);
        fetch(`${apiBase}/api/tickets?assigned_to=${user.id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        })
            .then(async (response) => {
            if (!response.ok) {
                throw new Error('Failed to load agent tickets');
            }
            return response.json();
        })
            .then((data) => {
            setBackendTickets(Array.isArray(data) ? data : []);
        })
            .catch((error) => {
            console.warn('Failed to load agent tickets from backend', error);
            setBackendTickets([]);
        })
            .finally(() => {
            setLoadingTickets(false);
        });
    }, [apiBase, user, token]);
    if (!currentAgent) {
        return (_jsxs("div", { className: "text-center py-16", children: [_jsx("h1", { className: "text-2xl font-semibold text-gray-900", children: "Agent dashboard unavailable" }), _jsx("p", { className: "text-gray-600 mt-2", children: "Please log in as a valid support agent." })] }));
    }
    // Get tickets assigned to current agent - match by numeric user_id
    const agentTickets = currentAgent && currentTickets.length > 0
        ? currentTickets.filter(t => {
            const assignedToId = t.assigned_to_id;
            // Match by user_id (numeric from the converted CSV data)
            return assignedToId === currentAgent.user_id;
        })
        : currentTickets.slice(0, 50);
    const openTickets = agentTickets.filter(t => !isResolvedOrClosed(t));
    const closedToday = agentTickets.filter(t => {
        return isResolvedOrClosed(t) &&
            t.resolved_date &&
            new Date(t.resolved_date).toDateString() === new Date().toDateString();
    });
    // Calculate average resolution time (uses duration field from CSV or DB)
    const ticketsWithDuration = agentTickets.filter(t => t.duration && t.duration > 0);
    const avgResolutionHours = ticketsWithDuration.length > 0
        ? (ticketsWithDuration.reduce((sum, t) => sum + (t.duration || 0), 0) / ticketsWithDuration.length / 60).toFixed(1)
        : 'N/A';
    // Apply filters
    let filteredTickets = openTickets;
    if (priorityFilter !== 'all') {
        filteredTickets = filteredTickets.filter(t => getPriorityLabel(t) === priorityFilter);
    }
    if (categoryFilter !== 'all') {
        filteredTickets = filteredTickets.filter(t => getCategoryLabel(t) === categoryFilter);
    }
    // Calculate category distribution from CSV or DB category field
    const categoryData = agentTickets.reduce((acc, ticket) => {
        const category = getCategoryLabel(ticket);
        acc[category] = (acc[category] || 0) + 1;
        return acc;
    }, {});
    const categoryChartData = Object.entries(categoryData).map(([name, count]) => ({
        name,
        value: count
    }));
    // Priority distribution from CSV or DB priority field
    const priorityMap = {};
    agentTickets.forEach(t => {
        const priority = getPriorityLabel(t);
        priorityMap[priority] = (priorityMap[priority] || 0) + 1;
    });
    const priorityData = Object.entries(priorityMap).map(([priority, count]) => ({
        priority,
        count
    }));
    // Task allocation suggestions - sorted by priority and date
    const suggestedTasks = openTickets
        .sort((a, b) => {
        // Prioritize by priority level
        const priorityOrder = { 'Critical': 1, 'High': 2, 'Medium': 3, 'Low': 4 };
        const aPriority = priorityOrder[a.priority] || 5;
        const bPriority = priorityOrder[b.priority] || 5;
        if (aPriority !== bPriority)
            return aPriority - bPriority;
        // Then by created date
        return new Date(a.created_date || '').getTime() - new Date(b.created_date || '').getTime();
    })
        .slice(0, 10);
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900", children: "IT Support Agent Dashboard" }), _jsx("p", { className: "text-gray-600 mt-1", children: "Your task allocation and workload analysis" })] }), showAgentSelector ? (_jsxs("div", { className: "w-full max-w-xs", children: [_jsx("label", { className: "text-sm font-medium text-gray-700 block mb-2", children: "Select Agent" }), _jsxs(Select, { value: selectedAgent?.toString() || '', onValueChange: (value) => setSelectedAgent(parseInt(value, 10)), children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, { placeholder: "Choose an agent" }) }), _jsx(SelectContent, { children: agents.map(agent => (_jsxs(SelectItem, { value: agent.id, children: [agent.first_name || agent.name, " ", agent.last_name || ''] }, agent.id))) })] })] })) : null] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium text-gray-600", children: "Open Tasks" }), _jsx(ListTodo, { className: "w-4 h-4 text-blue-600" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-3xl font-bold text-gray-900", children: openTickets.length }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Assigned to you" })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium text-gray-600", children: "Resolved Today" }), _jsx(CheckCircle2, { className: "w-4 h-4 text-green-600" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-3xl font-bold text-gray-900", children: closedToday.length }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Great progress!" })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium text-gray-600", children: "High Priority" }), _jsx(AlertCircle, { className: "w-4 h-4 text-red-600" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-3xl font-bold text-gray-900", children: openTickets.filter(t => {
                                            const priority = t.priority;
                                            return priority === 'Critical' || priority === 'High';
                                        }).length }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Urgent attention needed" })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium text-gray-600", children: "Avg Resolution Time" }), _jsx(Clock, { className: "w-4 h-4 text-indigo-600" })] }), _jsxs(CardContent, { children: [_jsxs("div", { className: "text-3xl font-bold text-gray-900", children: [avgResolutionHours, "h"] }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Your performance" })] })] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Your Workload by Priority" }) }), _jsx(CardContent, { children: _jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(BarChart, { data: priorityData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "priority" }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Bar, { dataKey: "count", fill: "#4F46E5", name: "Open Tickets" })] }) }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Ticket Distribution by Category" }) }), _jsx(CardContent, { children: _jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(PieChart, { children: [_jsx(Pie, { data: categoryChartData, cx: "50%", cy: "50%", labelLine: false, label: ({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`, outerRadius: 100, fill: "#8884d8", dataKey: "value", children: categoryChartData.map((entry, index) => (_jsx(Cell, { fill: COLORS[index % COLORS.length] }, `cell-${index}`))) }), _jsx(Tooltip, {})] }) }) })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Recommended Task Allocation - Start Here" }) }), _jsxs(CardContent, { children: [_jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Tasks ordered by priority and age. We recommend starting with P1 critical issues." }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b", children: [_jsx("th", { className: "text-left p-2 font-medium", children: "Ticket ID" }), _jsx("th", { className: "text-left p-2 font-medium", children: "Priority" }), _jsx("th", { className: "text-left p-2 font-medium", children: "Category" }), _jsx("th", { className: "text-left p-2 font-medium", children: "Status" }), _jsx("th", { className: "text-left p-2 font-medium", children: "Age (days)" }), _jsx("th", { className: "text-left p-2 font-medium", children: "SLA Status" })] }) }), _jsx("tbody", { children: suggestedTasks.map(ticket => {
                                                const createdDate = new Date(ticket.created_date || '');
                                                const age = Math.floor((new Date().getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                                                const status = ticket.status || 'Unknown';
                                                const priority = ticket.priority || 'Unknown';
                                                const category = ticket.category || 'Unknown';
                                                const madeSla = ticket.made_sla;
                                                const slaStatus = madeSla ? 'met' : 'at_risk';
                                                return (_jsxs("tr", { className: "border-b hover:bg-gray-50", children: [_jsx("td", { className: "p-2 font-mono text-xs", children: ticket.ticket_id }), _jsx("td", { className: "p-2", children: _jsx("span", { className: `px-2 py-1 rounded text-xs font-medium ${priority === 'Critical' ? 'bg-red-100 text-red-800' :
                                                                    priority === 'High' ? 'bg-orange-100 text-orange-800' :
                                                                        priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                                                            'bg-gray-100 text-gray-800'}`, children: priority }) }), _jsx("td", { className: "p-2", children: category }), _jsx("td", { className: "p-2", children: _jsx("span", { className: "px-2 py-1 rounded text-xs bg-blue-100 text-blue-800", children: status }) }), _jsx("td", { className: "p-2", children: age }), _jsx("td", { className: "p-2", children: _jsx("span", { className: `px-2 py-1 rounded text-xs ${slaStatus === 'met' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`, children: slaStatus === 'met' ? 'On Track' : 'At Risk' }) })] }, ticket.ticket_id));
                                            }) })] }) })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", children: [_jsx(CardTitle, { children: "All My Tasks" }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Select, { value: priorityFilter, onValueChange: setPriorityFilter, children: [_jsx(SelectTrigger, { className: "w-32", children: _jsx(SelectValue, { placeholder: "Priority" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "all", children: "All Priorities" }), _jsx(SelectItem, { value: "Critical", children: "Critical" }), _jsx(SelectItem, { value: "High", children: "High" }), _jsx(SelectItem, { value: "Medium", children: "Medium" }), _jsx(SelectItem, { value: "Low", children: "Low" })] })] }), _jsxs(Select, { value: categoryFilter, onValueChange: setCategoryFilter, children: [_jsx(SelectTrigger, { className: "w-40", children: _jsx(SelectValue, { placeholder: "Category" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "all", children: "All Categories" }), Array.from(new Set(currentTickets.map((t) => t.category))).map(category => (_jsx(SelectItem, { value: String(category), children: String(category) }, category)))] })] })] })] }) }), _jsx(CardContent, { children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b", children: [_jsx("th", { className: "text-left p-2 font-medium", children: "Ticket ID" }), _jsx("th", { className: "text-left p-2 font-medium", children: "Priority" }), _jsx("th", { className: "text-left p-2 font-medium", children: "Category" }), _jsx("th", { className: "text-left p-2 font-medium", children: "Status" }), _jsx("th", { className: "text-left p-2 font-medium", children: "Opened" })] }) }), _jsx("tbody", { children: filteredTickets.slice(0, 20).map(ticket => (_jsxs("tr", { className: "border-b hover:bg-gray-50", children: [_jsx("td", { className: "p-2 font-mono text-xs", children: ticket.ticket_id }), _jsx("td", { className: "p-2", children: _jsx("span", { className: `px-2 py-1 rounded text-xs ${ticket.priority === 'Critical' ? 'bg-red-100 text-red-800' :
                                                            ticket.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                                                                ticket.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                                                    'bg-gray-100 text-gray-800'}`, children: ticket.priority }) }), _jsx("td", { className: "p-2", children: ticket.category }), _jsx("td", { className: "p-2", children: ticket.status }), _jsx("td", { className: "p-2", children: new Date(ticket.created_date || '').toLocaleDateString() })] }, ticket.ticket_id))) })] }) }) })] })] }));
}
