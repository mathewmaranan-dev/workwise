import { Ticket } from '../data/seedData';

/**
 * Generates sample ticket data for testing and demonstration
 */
export const generateSampleTickets = (count: number = 250): Ticket[] => {
  const tickets: Ticket[] = [];
  const now = new Date();
  const descriptions = [
    'Network connectivity issue',
    'VPN access not working',
    'Email sync problems',
    'Password reset required',
    'Printer not responding',
    'Software license expired',
    'Hardware malfunction',
    'Disk space low',
    'System performance degradation',
    'User account locked',
    'Authentication failure',
    'Database connection timeout',
    'Application crash on startup',
    'File sharing permissions issue',
    'Monitor not detected'
  ];

  const priorities = [1, 1, 2, 2, 3, 3, 4]; // Weighted towards lower priority
  const impacts = [1, 2, 3, 4];
  const urgencies = [1, 2, 3];
  const statuses = [1, 2, 3, 4, 5]; 
  const categories = [1, 2, 3, 4, 5, 6, 7, 8];
  const channels = [1, 2, 3, 4, 5];
  const sources = [1, 2, 3, 4];
  const assignmentGroups = [1, 2, 3, 4, 5];
  const slas = [1, 2, 3, 4];

  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(Math.random() * 90); // Last 90 days
    const createdDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const isResolved = status === 3 || status === 4;
    
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    const durationMinutes = isResolved 
      ? Math.floor(Math.random() * 480) + 60 // 1-8 hours
      : null;
    
    let resolvedDate: string | undefined;
    if (isResolved && durationMinutes) {
      resolvedDate = new Date(createdDate.getTime() + durationMinutes * 60 * 1000).toISOString();
    }

    const slaDueDate = new Date(createdDate.getTime() + 3600000 * [2, 4, 8, 24][priority - 1]).toISOString();
    const madeSLA = !isResolved || (resolvedDate ? new Date(resolvedDate) <= new Date(slaDueDate) : false);

    const assignedToId = Math.random() > 0.1 ? Math.floor(Math.random() * 3) + 2 : undefined;
    const closedById = status === 4 ? assignedToId : undefined;

    const ticket: Ticket = {
      ticket_id: `TKT-${String(100000 + i).slice(-6)}`,
      created_date: createdDate.toISOString(),
      resolved_date: resolvedDate,
      last_reopened_at: Math.random() > 0.9 ? new Date(createdDate.getTime() + Math.random() * 48 * 60 * 60 * 1000).toISOString() : undefined,
      duration: durationMinutes || undefined,
      reopen_count: Math.random() > 0.85 ? Math.floor(Math.random() * 3) + 1 : 0,
      reassignment_count: Math.floor(Math.random() * 2),
      short_description: descriptions[Math.floor(Math.random() * descriptions.length)],
      work_notes: Math.random() > 0.5 ? 'Issue investigated and resolved' : undefined,
      made_sla: madeSLA,
      fcr: Math.random() > 0.25 ? true : false, // 75% FCR rate
      requester_id: Math.floor(Math.random() * 10) + 1,
      assigned_to_id: assignedToId,
      closed_by_id: closedById,
      assignment_group_id: assignmentGroups[Math.floor(Math.random() * assignmentGroups.length)],
      priority_id: priority,
      impact_id: impacts[Math.floor(Math.random() * impacts.length)],
      urgency_id: urgencies[Math.floor(Math.random() * urgencies.length)],
      status_id: status,
      category_id: categories[Math.floor(Math.random() * categories.length)],
      subcategory_id: Math.random() > 0.5 ? Math.floor(Math.random() * 4) + 1 : undefined,
      channel_id: channels[Math.floor(Math.random() * channels.length)],
      source_id: sources[Math.floor(Math.random() * sources.length)],
      sla_id: slas[Math.floor(Math.random() * slas.length)],
      sla_duedate: slaDueDate
    };

    tickets.push(ticket);
  }

  return tickets;
};

/**
 * Export sample tickets as CSV string
 */
export const exportTicketsAsCSV = (tickets: Ticket[]): string => {
  const headers = [
    'ticket_id', 'created_date', 'resolved_date', 'last_reopened_at', 'duration',
    'reopen_count', 'reassignment_count', 'short_description', 'work_notes',
    'made_sla', 'fcr', 'requester_id', 'assigned_to_id', 'closed_by_id',
    'assignment_group_id', 'priority_id', 'impact_id', 'urgency_id', 'status_id',
    'sub_status_id', 'category_id', 'subcategory_id', 'channel_id', 'source_id',
    'config_item_id', 'sla_id', 'sla_duedate'
  ];

  const rows = tickets.map(t => [
    t.ticket_id,
    t.created_date,
    t.resolved_date || '',
    t.last_reopened_at || '',
    t.duration?.toString() || '',
    t.reopen_count.toString(),
    t.reassignment_count.toString(),
    `"${t.short_description.replace(/"/g, '""')}"`,
    t.work_notes ? `"${t.work_notes.replace(/"/g, '""')}"` : '',
    t.made_sla.toString(),
    t.fcr.toString(),
    t.requester_id.toString(),
    t.assigned_to_id?.toString() || '',
    t.closed_by_id?.toString() || '',
    t.assignment_group_id?.toString() || '',
    t.priority_id.toString(),
    t.impact_id.toString(),
    t.urgency_id.toString(),
    t.status_id.toString(),
    t.sub_status_id?.toString() || '',
    t.category_id.toString(),
    t.subcategory_id?.toString() || '',
    t.channel_id.toString(),
    t.source_id.toString(),
    t.config_item_id?.toString() || '',
    t.sla_id.toString(),
    t.sla_duedate || ''
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
};
