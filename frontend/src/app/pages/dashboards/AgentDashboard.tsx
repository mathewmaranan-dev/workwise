import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { ListTodo, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { tickets as seedDataTickets, getCategoryById, getPriorityById, getStatusById, users } from '../../data/seedData';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

const COLORS = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

export default function AgentDashboard({ showAgentSelector = false }: { showAgentSelector?: boolean }) {
  const { user } = useAuth();
  const { data: uploadedData } = useData();
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Use uploaded data if available, otherwise use seed data
  const currentTickets = (uploadedData && uploadedData.length > 0) ? uploadedData : seedDataTickets;

  // Get all agents (users with role_id 4 = agent)
  const agents = users.filter(u => u.role_id === 4);
  const [selectedAgent, setSelectedAgent] = useState<number | null>(showAgentSelector ? (agents[0]?.user_id ?? null) : null);
  const currentUserId = user ? parseInt(user.id, 10) : null;
  const currentAgent = showAgentSelector
    ? selectedAgent !== null ? agents.find(a => a.user_id === selectedAgent) : null
    : currentUserId !== null ? agents.find(a => a.user_id === currentUserId) : null;

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
  
  // Map CSV status text to status codes for filtering
  const getStatusId = (statusText: string): number => {
    const statusMap: Record<string, number> = {
      'resolved': 3,
      'closed': 4,
      'in progress': 2,
      'on hold': 5,
      'open': 6,
      'new': 1
    };
    return statusMap[statusText.toLowerCase()] || 1;
  };

  const openTickets = agentTickets.filter(t => {
    const statusId = getStatusId((t as any).status || '');
    return statusId !== 3 && statusId !== 4;
  });
  
  const closedToday = agentTickets.filter(t => {
    const statusId = getStatusId((t as any).status || '');
    return (statusId === 3 || statusId === 4) && 
      (t as any).resolved_date &&
      new Date((t as any).resolved_date).toDateString() === new Date().toDateString();
  });

  // Calculate average resolution time (uses duration field from CSV)
  const ticketsWithDuration = agentTickets.filter(t => (t as any).duration && (t as any).duration > 0);
  const avgResolutionHours = ticketsWithDuration.length > 0
    ? (ticketsWithDuration.reduce((sum, t) => sum + ((t as any).duration || 0), 0) / ticketsWithDuration.length / 60).toFixed(1)
    : 'N/A';

  // Apply filters
  let filteredTickets = openTickets;
  if (priorityFilter !== 'all') {
    filteredTickets = filteredTickets.filter(t => (t as any).priority === priorityFilter);
  }
  if (categoryFilter !== 'all') {
    filteredTickets = filteredTickets.filter(t => (t as any).category === categoryFilter);
  }

  // Calculate category distribution from CSV category field
  const categoryData = agentTickets.reduce((acc, ticket) => {
    const category = (ticket as any).category || 'Uncategorized';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryChartData = Object.entries(categoryData).map(([name, count]) => ({
    name,
    value: count
  }));

  // Priority distribution from CSV priority field
  const priorityMap: Record<string, number> = {};
  agentTickets.forEach(t => {
    const priority = (t as any).priority || 'Unknown';
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
                  <SelectItem key={agent.user_id} value={agent.user_id.toString()}>
                    {agent.first_name} {agent.last_name}
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
