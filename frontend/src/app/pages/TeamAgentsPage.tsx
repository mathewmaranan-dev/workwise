import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { getAssignmentGroupById, getCategoryById, getUserById, tickets as seedDataTickets, users as seedUsers, Ticket } from '../data/seedData';

type TicketFilter = 'all' | 'active' | 'closed';

export default function TeamAgentsPage() {
  const { data: uploadedData } = useData();
  const { user } = useAuth();
  const currentTickets = useMemo(() => (uploadedData && uploadedData.length > 0 ? uploadedData : seedDataTickets), [uploadedData]);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [ticketFilter, setTicketFilter] = useState<TicketFilter>('all');

  const agents = useMemo(
    () => seedUsers.filter((u) => u.role_id === 4),
    []
  );

  const selectedAgent = selectedAgentId ? getUserById(selectedAgentId) : undefined;
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
        <p className="text-gray-600 mt-1">Viewing all agents across all assignment groups.</p>
        <p className="text-gray-500 text-sm mt-2">Select an agent to inspect their active and closed ticket history.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Agent</th>
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-left p-3 font-medium">Team</th>
                  <th className="text-left p-3 font-medium">Active</th>
                  <th className="text-left p-3 font-medium">Closed</th>
                  <th className="text-left p-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {agents.length === 0 ? (
                  <tr className="border-b hover:bg-gray-50">
                    <td className="p-3 text-sm text-gray-500" colSpan={6}>
                      No agents available.
                    </td>
                  </tr>
                ) : (
                  agents.map((agent) => {
                    const agentTickets = currentTickets.filter((t) => t.assigned_to_id === agent.user_id);
                    const activeCount = agentTickets.filter((t) => t.status_id !== 3 && t.status_id !== 4).length;
                    const closedCount = agentTickets.filter((t) => t.status_id === 3 || t.status_id === 4).length;
                    const group = agent.assignment_group_id ? getAssignmentGroupById(agent.assignment_group_id) : undefined;
                    return (
                      <tr key={agent.user_id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{agent.first_name} {agent.last_name}</td>
                        <td className="p-3 text-sm text-slate-600">{agent.email}</td>
                        <td className="p-3 text-sm">{group?.group_name || 'Unassigned'}</td>
                        <td className="p-3">{activeCount}</td>
                        <td className="p-3">{closedCount}</td>
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
                    );
                  })
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
                <p className="text-xs text-gray-500 mt-1">{selectedAgent.email} — {selectedAgent.assignment_group_id ? getAssignmentGroupById(selectedAgent.assignment_group_id)?.group_name : 'Unassigned team'}</p>
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
