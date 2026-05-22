import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { ListTodo, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { tickets as seedDataTickets } from '../../data/seedData';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

const COLORS = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

export default function AgentDashboard({ showAgentSelector = false }: { showAgentSelector?: boolean }) {
  const { user, users: authUsers } = useAuth();
  const { data: uploadedData } = useData();
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [backendTickets, setBackendTickets] = useState<any[] | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL || '';
  const token = typeof window !== 'undefined' ? localStorage.getItem('workwise_token') : null;

  // Use backend tickets if loaded, otherwise use uploaded or seed data.
  const currentTickets = backendTickets !== null
    ? backendTickets
    : (uploadedData && uploadedData.length > 0) ? uploadedData : seedDataTickets;

  // Get all agents from backend users
  const agents = authUsers.filter(u => u.role === 'agent');
  const [selectedAgent, setSelectedAgent] = useState<number | null>(showAgentSelector ? (agents[0]?.id ? parseInt(agents[0].id, 10) : null) : null);
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

  const getStatusId = (ticket: any): number => {
    if (ticket?.status) {
      const statusText = String(ticket.status || ticket.status_name || '').toLowerCase();
      const statusMap: Record<string, number> = {
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

  const isResolvedOrClosed = (ticket: any): boolean => {
    if (ticket?.status) {
      const statusId = getStatusId(ticket);
      return statusId === 3 || statusId === 4;
    }
    return Number(ticket?.status_id) === 3;
  };

  const getPriorityLabel = (ticket: any): string => {
    if (ticket?.priority) return ticket.priority;
    const map: Record<number, string> = {
      1: 'Low',
      2: 'Medium',
      3: 'High',
      4: 'Critical'
    };
    return map[Number(ticket?.priority_id)] || 'Unknown';
  };

  const getCategoryLabel = (ticket: any): string => {
    if (ticket?.category) return ticket.category;
    const map: Record<number, string> = {
      1: 'Password',
      2: 'Server',
      3: 'Network',
      4: 'Software',
      5: 'Hardware'
    };
    return map[Number(ticket?.category_id)] || 'Uncategorized';
  };

  useEffect(() => {
    if (!apiBase || !user || user.role !== 'agent' || !token) return;

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
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-semibold text-gray-900">Agent dashboard unavailable</h1>
        <p className="text-gray-600 mt-2">Please log in as a valid support agent.</p>
      </div>
    );
  }

  // Get tickets assigned to current agent - match by numeric user_id
  const agentTickets = currentAgent && currentTickets.length > 0
    ? currentTickets.filter(t => {
        const assignedToId = (t as any).assigned_to_id;
        // Match by user_id (numeric from the converted CSV data)
        return assignedToId === currentAgent.user_id;
      })
    : currentTickets.slice(0, 50);

  const openTickets = agentTickets.filter(t => !isResolvedOrClosed(t));
  
  const closedToday = agentTickets.filter(t => {
    return isResolvedOrClosed(t) &&
      (t as any).resolved_date &&
      new Date((t as any).resolved_date).toDateString() === new Date().toDateString();
  });

  // Calculate average resolution time (uses duration field from CSV or DB)
  const ticketsWithDuration = agentTickets.filter(t => (t as any).duration && (t as any).duration > 0);
  const avgResolutionHours = ticketsWithDuration.length > 0
    ? (ticketsWithDuration.reduce((sum, t) => sum + ((t as any).duration || 0), 0) / ticketsWithDuration.length / 60).toFixed(1)
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
  }, {} as Record<string, number>);

  const categoryChartData = Object.entries(categoryData).map(([name, count]) => ({
    name,
    value: count
  }));

  // Priority distribution from CSV or DB priority field
  const priorityMap: Record<string, number> = {};
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
      const priorityOrder: Record<string, number> = { 'Critical': 1, 'High': 2, 'Medium': 3, 'Low': 4 };
      const aPriority = priorityOrder[(a as any).priority] || 5;
      const bPriority = priorityOrder[(b as any).priority] || 5;
      if (aPriority !== bPriority) return aPriority - bPriority;
      // Then by created date
      return new Date((a as any).created_date || '').getTime() - new Date((b as any).created_date || '').getTime();
    })
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">IT Support Agent Dashboard</h1>
          <p className="text-gray-600 mt-1">Your task allocation and workload analysis</p>
        </div>
        {showAgentSelector ? (
          <div className="w-full max-w-xs">
            <label className="text-sm font-medium text-gray-700 block mb-2">Select Agent</label>
            <Select value={selectedAgent?.toString() || ''} onValueChange={(value) => setSelectedAgent(parseInt(value, 10))}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.first_name || agent.name} {agent.last_name || ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Open Tasks</CardTitle>
            <ListTodo className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{openTickets.length}</div>
            <p className="text-xs text-gray-500 mt-1">Assigned to you</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Resolved Today</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{closedToday.length}</div>
            <p className="text-xs text-gray-500 mt-1">Great progress!</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">High Priority</CardTitle>
            <AlertCircle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {openTickets.filter(t => {
                const priority = (t as any).priority;
                return priority === 'Critical' || priority === 'High';
              }).length}
            </div>
            <p className="text-xs text-gray-500 mt-1">Urgent attention needed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Resolution Time</CardTitle>
            <Clock className="w-4 h-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {avgResolutionHours}h
            </div>
            <p className="text-xs text-gray-500 mt-1">Your performance</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Your Workload by Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="priority" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#4F46E5" name="Open Tickets" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ticket Distribution by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Task Allocation Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Task Allocation - Start Here</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Tasks ordered by priority and age. We recommend starting with P1 critical issues.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Ticket ID</th>
                  <th className="text-left p-2 font-medium">Priority</th>
                  <th className="text-left p-2 font-medium">Category</th>
                  <th className="text-left p-2 font-medium">Status</th>
                  <th className="text-left p-2 font-medium">Age (days)</th>
                  <th className="text-left p-2 font-medium">SLA Status</th>
                </tr>
              </thead>
              <tbody>
                {suggestedTasks.map(ticket => {
                  const createdDate = new Date((ticket as any).created_date || '');
                  const age = Math.floor((new Date().getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                  const status = (ticket as any).status || 'Unknown';
                  const priority = (ticket as any).priority || 'Unknown';
                  const category = (ticket as any).category || 'Unknown';
                  const madeSla = (ticket as any).made_sla;
                  const slaStatus = madeSla ? 'met' : 'at_risk';
                  
                  return (
                    <tr key={(ticket as any).ticket_id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-mono text-xs">{(ticket as any).ticket_id}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          priority === 'Critical' ? 'bg-red-100 text-red-800' :
                          priority === 'High' ? 'bg-orange-100 text-orange-800' :
                          priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {priority}
                        </span>
                      </td>
                      <td className="p-2">{category}</td>
                      <td className="p-2">
                        <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                          {status}
                        </span>
                      </td>
                      <td className="p-2">{age}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          slaStatus === 'met' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {slaStatus === 'met' ? 'On Track' : 'At Risk'}
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

      {/* All Tasks with Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>All My Tasks</CardTitle>
            <div className="flex gap-2">
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Array.from(new Set(currentTickets.map((t: any) => t.category))).map(category => (
                    <SelectItem key={category} value={String(category)}>
                      {String(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Ticket ID</th>
                  <th className="text-left p-2 font-medium">Priority</th>
                  <th className="text-left p-2 font-medium">Category</th>
                  <th className="text-left p-2 font-medium">Status</th>
                  <th className="text-left p-2 font-medium">Opened</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.slice(0, 20).map(ticket => (
                  <tr key={(ticket as any).ticket_id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-mono text-xs">{(ticket as any).ticket_id}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        (ticket as any).priority === 'Critical' ? 'bg-red-100 text-red-800' :
                        (ticket as any).priority === 'High' ? 'bg-orange-100 text-orange-800' :
                        (ticket as any).priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {(ticket as any).priority}
                      </span>
                    </td>
                    <td className="p-2">{(ticket as any).category}</td>
                    <td className="p-2">{(ticket as any).status}</td>
                    <td className="p-2">{new Date((ticket as any).created_date || '').toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
