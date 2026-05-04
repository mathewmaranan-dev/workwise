import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Users, Activity, AlertTriangle, Target, Filter } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { calculateKPIs, getAssignmentGroupPerformance, getNonFCRTickets, getNewTickets, getInProgressTickets, getClosedTickets, getEmployeePerformance } from '../../utils/analytics';
import { 
  tickets as seedDataTickets, 
  weeklyCounts, 
  getAssignmentGroupById, 
  getCategoryById,
  getUserById,
  assignmentGroups 
} from '../../data/seedData';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Button } from '../../components/ui/button';

export default function ManagerDashboard() {
  const { user } = useAuth();
  const { data: uploadedData } = useData();
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'new' | 'closed'>('all');
  
  // Use uploaded data if available; otherwise use seeded data
  const currentTickets = (uploadedData && uploadedData.length > 0) ? uploadedData : seedDataTickets;
  const hasData = currentTickets.length > 0;
  
  // Get manager's assignment group
  const managerGroupId = user?.id === '2' ? 1 : 2; // Default to group 1 for manager (can be dynamic)
  const managerGroup = getAssignmentGroupById(managerGroupId);
  
  // Filter tickets by manager's assignment group
  const groupTickets = currentTickets.filter(t => t.assignment_group_id === managerGroupId);
  
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
    if (!hasData) return [] as { week: string; tickets: number }[];
    const map: Record<string, number> = {};
    currentTickets.forEach((t: any) => {
      if (t.assignment_group_id !== managerGroupId) return;
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

  // Non-FCR tickets for this group
  const groupNonFCRTickets = getNonFCRTickets(currentTickets)
    .filter(t => t.assignment_group_id === managerGroupId);

  // Active tickets based on filter
  let filteredTickets = groupTickets;
  if (filterStatus === 'active') {
    filteredTickets = groupTickets.filter(t => t.status_id !== 3 && t.status_id !== 4);
  } else if (filterStatus === 'new') {
    filteredTickets = groupTickets.filter(t => t.status_id === 1);
  } else if (filterStatus === 'closed') {
    filteredTickets = groupTickets.filter(t => t.status_id === 3 || t.status_id === 4);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Team Manager Dashboard</h1>
        <p className="text-gray-600 mt-1">Team: {managerGroup?.group_name}</p>
      </div>

      {/* KPI Cards for Manager's Group */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">SLA Compliance</CardTitle>
            <Target className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{hasData ? `${groupKPIs.slaCompliance.toFixed(1)}%` : 'N/A'}</div>
            <p className="text-xs text-gray-500 mt-1">{hasData ? `${groupKPIs.totalTickets} total tickets` : 'No data'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">FCR Rate</CardTitle>
            <Activity className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{hasData ? `${groupKPIs.fcrRate.toFixed(1)}%` : 'N/A'}</div>
            <p className="text-xs text-gray-500 mt-1">First contact resolution</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Tickets</CardTitle>
            <Users className="w-4 h-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{hasData ? groupKPIs.activeTickets : 'N/A'}</div>
            <p className="text-xs text-gray-500 mt-1">Requiring attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Non-FCR Alerts</CardTitle>
            <AlertTriangle className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{hasData ? groupNonFCRTickets.length : 'N/A'}</div>
            <p className="text-xs text-gray-500 mt-1">Tickets needing review</p>
          </CardContent>
        </Card>
      </div>

      {/* Task Allocation & Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Task Allocation Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={taskAllocationData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {taskAllocationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{newTasks}</div>
                <p className="text-xs text-gray-500">New Tasks</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{assignedTasks}</div>
                <p className="text-xs text-gray-500">Assigned</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600">{pendingTasks}</div>
                <p className="text-xs text-gray-500">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Workload Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyGroupData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="tickets" stroke="#4F46E5" strokeWidth={2} name="Weekly Tickets" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Non-FCR Detection List */}
      <Card>
        <CardHeader>
          <CardTitle>Non-FCR Detection List - Action Required</CardTitle>
          <p className="text-xs text-gray-500 mt-1">Tickets requiring follow-up or escalation</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Ticket ID</th>
                  <th className="text-left p-3 font-medium">Priority</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Age (days)</th>
                  <th className="text-left p-3 font-medium">Reopens</th>
                </tr>
              </thead>
              <tbody>
                {groupNonFCRTickets.slice(0, 10).map(ticket => {
                  const age = Math.floor(
                    (new Date().getTime() - new Date(ticket.created_date).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  const fullTicket = groupTickets.find(t => t.ticket_id === ticket.ticket_id);
                  return (
                    <tr key={ticket.ticket_id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-mono text-xs font-medium">{ticket.ticket_id}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          ticket.priority_id === 1 ? 'bg-red-100 text-red-800' :
                          ticket.priority_id === 2 ? 'bg-orange-100 text-orange-800' :
                          ticket.priority_id === 3 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          P{ticket.priority_id}
                        </span>
                      </td>
                      <td className="p-3">{getCategoryById(ticket.category_id)?.category_name}</td>
                      <td className="p-3 text-xs">
                        {fullTicket?.status_id === 1 && 'New'}
                        {fullTicket?.status_id === 2 && 'In Progress'}
                        {fullTicket?.status_id === 3 && 'Resolved'}
                        {fullTicket?.status_id === 4 && 'Closed'}
                        {fullTicket?.status_id === 5 && 'On Hold'}
                      </td>
                      <td className="p-3">{age}d</td>
                      <td className="p-3 text-center">
                        {(fullTicket?.reopen_count ?? 0) > 0 && (
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
                            {fullTicket?.reopen_count}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Agent FCR Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Agent First Contact Resolution (FCR) Performance</CardTitle>
          <p className="text-xs text-gray-500 mt-1">Agents by FCR rate - identify training needs</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Agent</th>
                  <th className="text-left p-3 font-medium">Tickets Resolved</th>
                  <th className="text-left p-3 font-medium">FCR Rate</th>
                  <th className="text-left p-3 font-medium">FCR Count</th>
                  <th className="text-left p-3 font-medium">Non-FCR</th>
                </tr>
              </thead>
              <tbody>
                {getEmployeePerformance(currentTickets)
                  .sort((a, b) => b.ticketsResolved - a.ticketsResolved)
                  .slice(0, 10)
                  .map(agent => {
                    const agentTickets = currentTickets.filter(t => t.assigned_to_id === agent.userId);
                    const fcrCount = agentTickets.filter(t => t.fcr === true).length;
                    const nonFcrCount = agentTickets.filter(t => t.fcr === false).length;
                    const user = getUserById(agent.userId);
                    const fcrColor = agent.fcrRate >= 80 ? 'text-green-600' : agent.fcrRate >= 60 ? 'text-yellow-600' : 'text-red-600';
                    
                    return (
                      <tr key={agent.userId} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{user?.first_name} {user?.last_name}</td>
                        <td className="p-3">{agent.ticketsResolved}</td>
                        <td className={`p-3 font-bold ${fcrColor}`}>{agent.fcrRate.toFixed(1)}%</td>
                        <td className="p-3 text-green-600">{fcrCount}</td>
                        <td className="p-3 text-red-600">{nonFcrCount > 0 ? nonFcrCount : '—'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Active Tickets List with Filters */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Active Tickets</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('all')}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={filterStatus === 'new' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('new')}
            >
              New ({newTasks})
            </Button>
            <Button
              size="sm"
              variant={filterStatus === 'active' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('active')}
            >
              Active ({groupKPIs.activeTickets})
            </Button>
            <Button
              size="sm"
              variant={filterStatus === 'closed' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('closed')}
            >
              Closed
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Ticket ID</th>
                  <th className="text-left p-3 font-medium">Description</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Priority</th>
                  <th className="text-left p-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.slice(0, 15).map(ticket => (
                  <tr key={ticket.ticket_id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-mono text-xs font-medium">{ticket.ticket_id}</td>
                    <td className="p-3 truncate max-w-xs">{ticket.short_description}</td>
                    <td className="p-3 text-xs">
                      <span className={`px-2 py-1 rounded text-xs ${
                        ticket.status_id === 1 ? 'bg-blue-100 text-blue-800' :
                        ticket.status_id === 2 ? 'bg-purple-100 text-purple-800' :
                        ticket.status_id === 3 ? 'bg-green-100 text-green-800' :
                        ticket.status_id === 4 ? 'bg-gray-100 text-gray-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {ticket.status_id === 1 && 'New'}
                        {ticket.status_id === 2 && 'In Progress'}
                        {ticket.status_id === 3 && 'Resolved'}
                        {ticket.status_id === 4 && 'Closed'}
                        {ticket.status_id === 5 && 'Pending'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        ticket.priority_id === 1 ? 'bg-red-100 text-red-800' :
                        ticket.priority_id === 2 ? 'bg-orange-100 text-orange-800' :
                        ticket.priority_id === 3 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        P{ticket.priority_id}
                      </span>
                    </td>
                    <td className="p-3 text-xs">
                      {new Date(ticket.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
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
