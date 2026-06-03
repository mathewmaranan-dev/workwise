import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { assignmentGroups, getAssignmentGroupById, getCategoryById, getUserById, tickets as seedDataTickets, users as seedUsers, Ticket } from '../data/seedData';

type TicketFilter = 'all' | 'active' | 'closed';

type ShiftOption = 'all' | 'Morning' | 'Afternoon' | 'Night';

type PerformanceFilter = 'all' | 'High' | 'Medium' | 'Low';

type TeamFilter = 'all' | string;

export default function TeamAgentsPage() {
  const { data: uploadedData } = useData();
  const { user, users: authUsers } = useAuth();
  const currentTickets = useMemo(() => (uploadedData && uploadedData.length > 0 ? uploadedData : seedDataTickets), [uploadedData]);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [ticketFilter, setTicketFilter] = useState<TicketFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [shiftFilter, setShiftFilter] = useState<ShiftOption>('all');
  const [performanceFilter, setPerformanceFilter] = useState<PerformanceFilter>('all');
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all');

  const managerGroupId = user?.role === 'manager' ? user.assignment_group_id : undefined;
  const [managerSelectedGroup, setManagerSelectedGroup] = React.useState<number | undefined>(undefined);

  const effectiveManagerGroupId = user?.role === 'manager' ? (user.assignment_group_id ?? managerSelectedGroup) : undefined;

  const [managerGroupAgents, setManagerGroupAgents] = useState<any[] | null>(null);
  const env = (import.meta as any).env as Record<string, string | undefined>;
  const API_BASE = env.VITE_API_BASE_URL || env.VITE_API_URL || '';

  // When manager has an effective group, fetch live users from backend for that group
  useEffect(() => {
    const fetchGroupUsers = async () => {
      if (!effectiveManagerGroupId) return;
      try {
        const token = localStorage.getItem('workwise_token');
        const res = await fetch(`${API_BASE}/api/users/group/${effectiveManagerGroupId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) throw new Error('Failed to load group users');
        const data = await res.json();
        setManagerGroupAgents(data);
      } catch (err) {
        console.warn('Could not fetch group users', err);
        setManagerGroupAgents(null);
      }
    };

    if (user?.role === 'manager' && effectiveManagerGroupId != null) {
      fetchGroupUsers();
    } else {
      setManagerGroupAgents(null);
    }
  }, [effectiveManagerGroupId, user, API_BASE]);

  // Prefer live backend group users for managers; otherwise prefer authUsers or seedUsers.
  const allowedAgents = useMemo(() => {
    if (user?.role === 'manager' && managerGroupAgents && managerGroupAgents.length > 0) {
      return managerGroupAgents
        .filter((u: any) => String(u.role).toLowerCase() === 'agent')
        .map((u: any) => ({
          user_id: Number(u.id),
          first_name: u.first_name,
          last_name: u.last_name,
          email: u.email,
          assignment_group_id: u.assignment_group_id,
          shift: u.shift,
        }));
    }

    // Normalize auth users to the shape expected by the UI
    if (authUsers && authUsers.length > 0) {
      const backendAgents = authUsers
        .filter((u) => u.role === 'agent')
        .map((u) => ({
          user_id: Number(u.id),
          first_name: u.first_name || (u.name ? u.name.split(' ')[0] : ''),
          last_name: u.last_name || (u.name ? u.name.split(' ').slice(1).join(' ') : ''),
          email: u.email,
          assignment_group_id: u.assignment_group_id,
          shift: (u as any).shift,
        }));
      return backendAgents.filter((a) => effectiveManagerGroupId == null || a.assignment_group_id === effectiveManagerGroupId);
    }

    return seedUsers.filter((s) => s.role_id === 4 && (effectiveManagerGroupId == null || s.assignment_group_id === effectiveManagerGroupId));
  }, [authUsers, effectiveManagerGroupId, managerGroupAgents, user]);

  // If logged-in user is a manager, lock the team filter to their group (or to selected group)
  React.useEffect(() => {
    if (user?.role === 'manager' && effectiveManagerGroupId != null) {
      setTeamFilter(effectiveManagerGroupId.toString());
    }
  }, [user, effectiveManagerGroupId]);

  const agents = useMemo(() => {
    const shifts: ShiftOption[] = ['Morning', 'Afternoon', 'Night'];
    return allowedAgents.map((agent) => {
      const agentTickets = currentTickets.filter((ticket) => ticket.assigned_to_id === agent.user_id);
      const closedCount = agentTickets.filter((t) => t.status_id === 3 || t.status_id === 4).length;
      const activeCount = agentTickets.filter((t) => t.status_id !== 3 && t.status_id !== 4).length;
      const totalCount = Math.max(agentTickets.length, 1);
      const fcrRate = agentTickets.length > 0 ? (agentTickets.filter((t) => t.fcr).length / agentTickets.length) : 0;
      const closedPct = closedCount / totalCount;
      const performanceScore = Math.round((closedPct * 0.65 + fcrRate * 0.35) * 100);
      const performanceBand: PerformanceFilter = performanceScore >= 75 ? 'High' : performanceScore >= 50 ? 'Medium' : 'Low';
      const shift = (agent as any).shift || shifts[agent.user_id % shifts.length];
      const groupName = agent.assignment_group_id ? getAssignmentGroupById(agent.assignment_group_id)?.group_name : 'Unassigned';
      return {
        ...agent,
        activeCount,
        closedCount,
        totalTickets: agentTickets.length,
        fcrRate,
        performanceScore,
        performanceBand,
        shift,
        groupName,
      };
    });
  }, [allowedAgents, currentTickets]);

  const filteredAgents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return agents.filter((agent) => {
      // Managers can only see their own assignment group (enforce strictly)
      if (user?.role === 'manager' && effectiveManagerGroupId != null && agent.assignment_group_id !== effectiveManagerGroupId) {
        return false;
      }
      
      if (query) {
        const fullName = `${agent.first_name} ${agent.last_name}`.toLowerCase();
        if (!fullName.includes(query) && !agent.email.toLowerCase().includes(query) && !agent.groupName.toLowerCase().includes(query)) {
          return false;
        }
      }
      if (shiftFilter !== 'all' && agent.shift !== shiftFilter) return false;
      if (performanceFilter !== 'all' && agent.performanceBand !== performanceFilter) return false;
      if (teamFilter !== 'all' && agent.assignment_group_id?.toString() !== teamFilter) return false;
      return true;
    });
  }, [agents, searchQuery, shiftFilter, performanceFilter, teamFilter, user]);

  const findUserByIdLocal = (id: number) => {
    if (authUsers && authUsers.length > 0) {
      const u = authUsers.find((au) => Number(au.id) === id);
      if (u) return u as any;
    }
    return getUserById(id as any);
  };

  const selectedAgent = selectedAgentId ? findUserByIdLocal(selectedAgentId) : undefined;
  const selectedAgentTickets = useMemo(
    () => (selectedAgentId ? currentTickets.filter((t) => t.assigned_to_id === selectedAgentId) : []),
    [currentTickets, selectedAgentId]
  );

  const filteredAgentTickets = useMemo(() => {
    if (!selectedAgentId) return [];
    return selectedAgentTickets.filter((ticket) => {
      if (ticketFilter === 'active') {
        return ticket.status_id !== 3 && ticket.status_id !== 4;
      }
      if (ticketFilter === 'closed') {
        return ticket.status_id === 3 || ticket.status_id === 4;
      }
      return true;
    });
  }, [selectedAgentId, selectedAgentTickets, ticketFilter]);

  const getStatusLabel = (statusId: number) => {
    if (statusId === 1) return 'New';
    if (statusId === 2) return 'In Progress';
    if (statusId === 3) return 'Resolved';
    if (statusId === 4) return 'Closed';
    if (statusId === 5) return 'Pending';
    if (statusId === 6) return 'Open';
    return 'Unknown';
  };

  const getStatusStyle = (statusId: number) => {
    if (statusId === 1) return 'bg-blue-100 text-blue-800';
    if (statusId === 2) return 'bg-purple-100 text-purple-800';
    if (statusId === 3) return 'bg-green-100 text-green-800';
    if (statusId === 4) return 'bg-gray-100 text-gray-800';
    return 'bg-amber-100 text-amber-800';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Team Agents</h1>
        <p className="text-gray-600 mt-1">
          {user?.role === 'manager' && user.assignment_group_id
            ? `Viewing agents in ${user.assignment_group || getAssignmentGroupById(user.assignment_group_id)?.group_name || 'your assignment group'}.`
            : 'Viewing agents across all assignment groups.'}
        </p>

        {user?.role === 'manager' && !user.assignment_group_id && (
          <div className="mt-4 p-4 border rounded bg-yellow-50">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-sm font-medium">Which team do you manage?</div>
                <div className="text-xs text-gray-600">Select the assignment group to view its agents.</div>
              </div>
              <div className="w-64">
                <Select value={managerSelectedGroup != null ? managerSelectedGroup.toString() : undefined} onValueChange={(value) => setManagerSelectedGroup(value === '__none' ? undefined : parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None</SelectItem>
                    {assignmentGroups.map((group) => (
                      <SelectItem key={group.assignment_group_id} value={group.assignment_group_id.toString()}>
                        {group.group_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
        <p className="text-gray-500 text-sm mt-2">Search and filter agents by name, shift, and performance category</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search agent name, email, or team..."
              className="max-w-md"
            />

            <div className="flex flex-wrap gap-3">
              {user?.role === 'admin' && (
                <Select value={teamFilter} onValueChange={(value) => setTeamFilter(value as TeamFilter)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    {assignmentGroups.map((group) => (
                      <SelectItem key={group.assignment_group_id} value={group.assignment_group_id.toString()}>
                        {group.group_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={shiftFilter} onValueChange={(value) => setShiftFilter(value as ShiftOption)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shifts</SelectItem>
                  <SelectItem value="Morning">Morning</SelectItem>
                  <SelectItem value="Afternoon">Afternoon</SelectItem>
                  <SelectItem value="Night">Night</SelectItem>
                </SelectContent>
              </Select>

              <Select value={performanceFilter} onValueChange={(value) => setPerformanceFilter(value as PerformanceFilter)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Performance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Performance</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Agent</th>
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-left p-3 font-medium">Team</th>
                  <th className="text-left p-3 font-medium">Shift</th>
                  <th className="text-left p-3 font-medium">Performance</th>
                  <th className="text-left p-3 font-medium">Active</th>
                  <th className="text-left p-3 font-medium">Closed</th>
                  <th className="text-left p-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgents.length === 0 ? (
                  <tr className="border-b hover:bg-gray-50">
                    <td className="p-3 text-sm text-gray-500" colSpan={8}>
                      No agents match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((agent) => (
                    <tr key={agent.user_id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{agent.first_name} {agent.last_name}</td>
                      <td className="p-3 text-sm text-slate-600">{agent.email}</td>
                      <td className="p-3 text-sm">{agent.groupName}</td>
                      <td className="p-3 text-sm">{agent.shift}</td>
                      <td className="p-3 text-sm">{agent.performanceBand}</td>
                      <td className="p-3">{agent.activeCount}</td>
                      <td className="p-3">{agent.closedCount}</td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant={selectedAgentId === agent.user_id ? 'default' : 'outline'}
                          onClick={() => {
                            setSelectedAgentId(agent.user_id);
                            setTicketFilter('all');
                          }}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selectedAgent ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{selectedAgent.first_name} {selectedAgent.last_name}</CardTitle>
                <p className="text-xs text-gray-500 mt-1">{selectedAgent.email} — {selectedAgent.assignment_group || (selectedAgent.assignment_group_id ? getAssignmentGroupById(selectedAgent.assignment_group_id)?.group_name : 'Unassigned team')}</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <Button size="sm" variant={ticketFilter === 'all' ? 'default' : 'outline'} onClick={() => setTicketFilter('all')}>
                  All ({selectedAgentTickets.length})
                </Button>
                <Button size="sm" variant={ticketFilter === 'active' ? 'default' : 'outline'} onClick={() => setTicketFilter('active')}>
                  Active ({selectedAgentTickets.filter((t) => t.status_id !== 3 && t.status_id !== 4).length})
                </Button>
                <Button size="sm" variant={ticketFilter === 'closed' ? 'default' : 'outline'} onClick={() => setTicketFilter('closed')}>
                  Closed ({selectedAgentTickets.filter((t) => t.status_id === 3 || t.status_id === 4).length})
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-medium">Ticket ID</th>
                      <th className="text-left p-3 font-medium">Description</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Category</th>
                      <th className="text-left p-3 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgentTickets.length === 0 ? (
                      <tr className="border-b hover:bg-gray-50">
                        <td className="p-3 text-sm text-gray-500" colSpan={5}>
                          No tickets match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      filteredAgentTickets.map((ticket) => (
                        <tr key={ticket.ticket_id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-mono text-xs font-medium">{ticket.ticket_id}</td>
                          <td className="p-3 truncate max-w-xs">{ticket.short_description}</td>
                          <td className="p-3 text-xs">
                            <span className={`px-2 py-1 rounded text-xs ${getStatusStyle(ticket.status_id)}`}>
                              {getStatusLabel(ticket.status_id)}
                            </span>
                          </td>
                          <td className="p-3 text-sm">{getCategoryById(ticket.category_id)?.category_name || '—'}</td>
                          <td className="p-3 text-xs">{new Date(ticket.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
