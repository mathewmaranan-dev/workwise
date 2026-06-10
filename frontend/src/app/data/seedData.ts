import * as Papa from 'papaparse';

// Data types matching ERD structure

export interface Role {
  role_id: number;
  role_name: string;
}

export interface User {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  password_hash?: string;
  role_id: number;
  assignment_group_id?: number;
}

export interface AssignmentGroup {
  assignment_group_id: number;
  group_name: string;
}

export interface Priority {
  priority_id: number;
  priority_level: string;
}

export interface Impact {
  impact_id: number;
  impact_level: string;
}

export interface Urgency {
  urgency_id: number;
  urgency_level: string;
}

export interface Status {
  status_id: number;
  status_name: string;
}

export interface SubStatus {
  sub_status_id: number;
  sub_status_name: string;
  status_id: number;
}

export interface Category {
  category_id: number;
  category_name: string;
}

export interface SubCategory {
  subcategory_id: number;
  subcategory_name: string;
  category_id: number;
}

export interface Channel {
  channel_id: number;
  channel_name: string;
}

export interface Source {
  source_id: number;
  source_name: string;
}

export interface ConfigurationItem {
  config_item_id: number;
  item_name: string;
}

export interface SLA {
  sla_id: number;
  sla_name: string;
  sla_hours: number;
}

export interface Survey {
  survey_id: number;
  ticket_id: string;
  survey_response: boolean;
  survey_comments?: string;
}

export interface Ticket {
  ticket_id: string;
  created_date: string;
  resolved_date?: string;
  last_reopened_at?: string;
  duration?: number;
  reopen_count: number;
  reassignment_count: number;
  short_description: string;
  work_notes?: string;
  made_sla: boolean;
  fcr: boolean;
  
  requester_id: number;
  assigned_to_id?: number;
  closed_by_id?: number;
  
  assignment_group_id?: number;
  priority_id: number;
  impact_id: number;
  urgency_id: number;
  status_id: number;
  sub_status_id?: number;
  category_id: number;
  subcategory_id?: number;
  channel_id: number;
  source_id: number;
  config_item_id?: number;
  sla_id: number;
  sla_duedate?: string;
}

export interface WeeklyCount {
  week_start: string;
  ticket_count: number;
}

// ============= SEED DATA =============

export const roles: Role[] = [
  { role_id: 1, role_name: 'admin' },
  { role_id: 2, role_name: 'manager' },
  { role_id: 3, role_name: 'hr' },
  { role_id: 4, role_name: 'agent' }
];

export const priorities: Priority[] = [
  { priority_id: 1, priority_level: 'Critical' },
  { priority_id: 2, priority_level: 'High' },
  { priority_id: 3, priority_level: 'Medium' },
  { priority_id: 4, priority_level: 'Low' }
];

export const impacts: Impact[] = [
  { impact_id: 1, impact_level: 'Critical' },
  { impact_id: 2, impact_level: 'High' },
  { impact_id: 3, impact_level: 'Medium' },
  { impact_id: 4, impact_level: 'Low' }
];

export const urgencies: Urgency[] = [
  { urgency_id: 1, urgency_level: 'High' },
  { urgency_id: 2, urgency_level: 'Medium' },
  { urgency_id: 3, urgency_level: 'Low' }
];

export const assignmentGroups: AssignmentGroup[] = [
  { assignment_group_id: 1, group_name: 'Software Team' },
  { assignment_group_id: 2, group_name: 'Network Team' },
  { assignment_group_id: 3, group_name: 'Security Team' },
  { assignment_group_id: 4, group_name: 'Hardware Team' },
  { assignment_group_id: 5, group_name: 'Service Desk' }
];

export const statuses: Status[] = [
  { status_id: 1, status_name: 'New' },
  { status_id: 2, status_name: 'In Progress' },
  { status_id: 3, status_name: 'Resolved' },
  { status_id: 4, status_name: 'Closed' },
  { status_id: 5, status_name: 'On Hold' },
  { status_id: 6, status_name: 'Open' }
];

export const subStatuses: SubStatus[] = [
  { sub_status_id: 1, sub_status_name: 'Awaiting User', status_id: 2 },
  { sub_status_id: 2, sub_status_name: 'In Review', status_id: 2 },
  { sub_status_id: 3, sub_status_name: 'Pending', status_id: 1 }
];

export const categories: Category[] = [
  { category_id: 1, category_name: 'Network Issues' },
  { category_id: 2, category_name: 'Software Installation' },
  { category_id: 3, category_name: 'Hardware Failure' },
  { category_id: 4, category_name: 'Account Access' },
  { category_id: 5, category_name: 'Email Issues' },
  { category_id: 6, category_name: 'VPN Access' },
  { category_id: 7, category_name: 'Password Reset' },
  { category_id: 8, category_name: 'Printer Issues' }
];

export const subCategories: SubCategory[] = [
  { subcategory_id: 1, subcategory_name: 'WiFi Connectivity', category_id: 1 },
  { subcategory_id: 2, subcategory_name: 'VPN Issues', category_id: 1 },
  { subcategory_id: 3, subcategory_name: 'Application License', category_id: 2 },
  { subcategory_id: 4, subcategory_name: 'System Patching', category_id: 2 }
];

export const channels: Channel[] = [
  { channel_id: 1, channel_name: 'Email' },
  { channel_id: 2, channel_name: 'Phone' },
  { channel_id: 3, channel_name: 'Chat' },
  { channel_id: 4, channel_name: 'Portal' },
  { channel_id: 5, channel_name: 'Self-Service' }
];

export const sources: Source[] = [
  { source_id: 1, source_name: 'User Request' },
  { source_id: 2, source_name: 'System Alert' },
  { source_id: 3, source_name: 'Management Request' },
  { source_id: 4, source_name: 'Incident' }
];

export const configurationItems: ConfigurationItem[] = [
  { config_item_id: 1, item_name: 'Server 1' },
  { config_item_id: 2, item_name: 'Server 2' },
  { config_item_id: 3, item_name: 'Workstations' },
  { config_item_id: 4, item_name: 'Network Equipment' }
];

export const slas: SLA[] = [
  { sla_id: 1, sla_name: 'Critical SLA', sla_hours: 2 },
  { sla_id: 2, sla_name: 'High Priority SLA', sla_hours: 4 },
  { sla_id: 3, sla_name: 'Medium Priority SLA', sla_hours: 8 },
  { sla_id: 4, sla_name: 'Low Priority SLA', sla_hours: 24 }
];

// Extended user list including agents and requesters from Quatro_Data
export const users: User[] = [
  { 
    user_id: 1, 
    first_name: 'Admin', 
    last_name: 'User', 
    email: 'admin@workwise.app', 
    role_id: 1 
  },
  { 
    user_id: 2, 
    first_name: 'ITSM', 
    last_name: 'Manager', 
    email: 'manager@workwise.app', 
    role_id: 2, 
    assignment_group_id: 1 
  },
  { 
    user_id: 3, 
    first_name: 'HR', 
    last_name: 'Manager', 
    email: 'hr@workwise.app', 
    role_id: 3 
  },
  { 
    user_id: 4, 
    first_name: 'IT Support', 
    last_name: 'Agent', 
    email: 'agent@workwise.app', 
    role_id: 4, 
    assignment_group_id: 1 
  },
  // Agents from Quatro_Data
  { user_id: 5, first_name: 'Laura', last_name: 'Diaz', email: 'laura.diaz@workwise.app', role_id: 4, assignment_group_id: 2 },
  { user_id: 6, first_name: 'Ulises', last_name: 'Gomez', email: 'ulises.gomez@workwise.app', role_id: 4, assignment_group_id: 1 },
  { user_id: 7, first_name: 'Alice', last_name: 'Mendoza', email: 'alice.mendoza@workwise.app', role_id: 4, assignment_group_id: 3 },
  { user_id: 8, first_name: 'Teresa', last_name: 'Herrera', email: 'teresa.herrera@workwise.app', role_id: 4, assignment_group_id: 1 },
  { user_id: 9, first_name: 'Kevin', last_name: 'Ramos', email: 'kevin.ramos@workwise.app', role_id: 4, assignment_group_id: 2 },
  { user_id: 10, first_name: 'Quentin', last_name: 'De Leon', email: 'quentin.deleon@workwise.app', role_id: 4, assignment_group_id: 3 },
  { user_id: 11, first_name: 'Mark', last_name: 'Castillo', email: 'mark.castillo@workwise.app', role_id: 4, assignment_group_id: 2 },
  // Requesters from Quatro_Data
  { user_id: 12, first_name: 'Pennie', last_name: 'Eldredge', email: 'pennie.eldredge@workwise.app', role_id: 4 },
  { user_id: 13, first_name: 'Lidia', last_name: 'Wrennall', email: 'lidia.wrennall@workwise.app', role_id: 4 },
  { user_id: 14, first_name: 'Werner', last_name: 'Kettlesting', email: 'werner.kettlesting@workwise.app', role_id: 4 },
  { user_id: 15, first_name: 'Erena', last_name: 'Benezet', email: 'erena.benezet@workwise.app', role_id: 4 },
  { user_id: 16, first_name: 'Jakob', last_name: 'Fleisch', email: 'jakob.fleisch@workwise.app', role_id: 4 },
  { user_id: 17, first_name: 'Debee', last_name: 'Fatharly', email: 'debee.fatharly@workwise.app', role_id: 4 },
  { user_id: 18, first_name: 'Loren', last_name: 'Isakovitch', email: 'loren.isakovitch@workwise.app', role_id: 4 },
  { user_id: 19, first_name: 'Normand', last_name: 'Entwisle', email: 'normand.entwisle@workwise.app', role_id: 4 },
  { user_id: 20, first_name: 'Dino', last_name: "O' Culligan", email: 'dino.oculligan@workwise.app', role_id: 4 },
  { user_id: 21, first_name: 'Toni', last_name: 'Colcomb', email: 'toni.colcomb@workwise.app', role_id: 4 }
];

// ============= CSV PARSING & DATA MANAGEMENT =============

/**
 * Parses CSV data matching ERD headers:
 * ticket_id, created_date, resolved_date, last_reopened_at, duration,
 * reopen_count, reassignment_count, short_description, work_notes,
 * made_sla, fcr, requester_id, assigned_to_id, closed_by_id,
 * assignment_group_id, priority_id, impact_id, urgency_id, status_id,
 * sub_status_id, category_id, subcategory_id, channel_id, source_id,
 * config_item_id, sla_id, sla_duedate
 */
export const parseCSVData = (csvContent: string): Ticket[] => {
  const parsedData = Papa.parse(csvContent, { header: true });
  const tickets: Ticket[] = [];

  parsedData.data.forEach((row: any, index: number) => {
    // Skip empty rows
    if (!row.ticket_id || !row.created_date) return;

    try {
      const ticket: Ticket = {
        ticket_id: String(row.ticket_id).trim(),
        created_date: new Date(row.created_date).toISOString(),
        resolved_date: row.resolved_date ? new Date(row.resolved_date).toISOString() : undefined,
        last_reopened_at: row.last_reopened_at ? new Date(row.last_reopened_at).toISOString() : undefined,
        duration: row.duration ? parseInt(row.duration) : undefined,
        reopen_count: row.reopen_count ? parseInt(row.reopen_count) : 0,
        reassignment_count: row.reassignment_count ? parseInt(row.reassignment_count) : 0,
        short_description: String(row.short_description || '').trim(),
        work_notes: row.work_notes ? String(row.work_notes).trim() : undefined,
        made_sla: String(row.made_sla).toLowerCase() === 'true',
        fcr: String(row.fcr).toLowerCase() === 'true',
        requester_id: parseInt(row.requester_id) || 1,
        assigned_to_id: row.assigned_to_id ? parseInt(row.assigned_to_id) : undefined,
        closed_by_id: row.closed_by_id ? parseInt(row.closed_by_id) : undefined,
        assignment_group_id: row.assignment_group_id ? parseInt(row.assignment_group_id) : undefined,
        priority_id: parseInt(row.priority_id) || 3,
        impact_id: parseInt(row.impact_id) || 3,
        urgency_id: parseInt(row.urgency_id) || 2,
        status_id: parseInt(row.status_id) || 1,
        sub_status_id: row.sub_status_id ? parseInt(row.sub_status_id) : undefined,
        category_id: parseInt(row.category_id) || 1,
        subcategory_id: row.subcategory_id ? parseInt(row.subcategory_id) : undefined,
        channel_id: parseInt(row.channel_id) || 1,
        source_id: parseInt(row.source_id) || 1,
        config_item_id: row.config_item_id ? parseInt(row.config_item_id) : undefined,
        sla_id: parseInt(row.sla_id) || 3,
        sla_duedate: row.sla_duedate ? new Date(row.sla_duedate).toISOString() : undefined
      };
      tickets.push(ticket);
    } catch (e) {
      console.warn(`Error parsing row ${index}:`, e);
    }
  });

  return tickets;
};

const calculateWeeklyCounts = (tickets: Ticket[]): WeeklyCount[] => {
  const weeklyCountsMap: { [key: string]: number } = {};

  tickets.forEach(ticket => {
    const weekStart = new Date(ticket.created_date);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    if (!weeklyCountsMap[weekStartStr]) {
      weeklyCountsMap[weekStartStr] = 0;
    }
    weeklyCountsMap[weekStartStr]++;
  });

  return Object.entries(weeklyCountsMap)
    .map(([week_start, ticket_count]) => ({
      week_start,
      ticket_count
    }))
    .sort((a, b) => new Date(a.week_start).getTime() - new Date(b.week_start).getTime());
};

// ============= EXPORTED MUTABLE DATA =============
export let tickets: Ticket[] = [];
export let weeklyCounts: WeeklyCount[] = [];

// Initialize with Quatro_Data (real CSV data)
const initializeQuatroData = (): Ticket[] => {
  const quatroTickets: Ticket[] = [
    {
      ticket_id: '1',
      created_date: new Date('2025-11-06').toISOString(),
      resolved_date: undefined,
      duration: 115.71,
      reopen_count: 1,
      reassignment_count: 0,
      short_description: 'Password reset required after MFA lockout.',
      work_notes: 'Assisted user with resetting credentials and verified access to corporate systems after the account was locked due to expired MFA tokens.',
      made_sla: true,
      fcr: true,
      requester_id: 12,
      assigned_to_id: 5,
      closed_by_id: 5,
      assignment_group_id: 3,
      priority_id: 4,
      impact_id: 3,
      urgency_id: 1,
      status_id: 3,
      category_id: 7,
      channel_id: 2,
      source_id: 1,
      sla_id: 4,
      sla_duedate: new Date('2025-11-07').toISOString()
    },
    {
      ticket_id: '2',
      created_date: new Date('2025-03-06').toISOString(),
      resolved_date: undefined,
      duration: 45.14,
      reopen_count: 1,
      reassignment_count: 1,
      short_description: 'Headquarters Wi-Fi disconnects intermittently.',
      work_notes: 'Checked access point logs, replaced a failing Wi-Fi radio, and confirmed stable connectivity for the affected floor.',
      made_sla: false,
      fcr: true,
      requester_id: 13,
      assigned_to_id: 6,
      closed_by_id: 6,
      assignment_group_id: 1,
      priority_id: 4,
      impact_id: 4,
      urgency_id: 3,
      status_id: 5,
      category_id: 1,
      channel_id: 2,
      source_id: 1,
      sla_id: 4,
      sla_duedate: new Date('2025-03-07').toISOString()
    },
    {
      ticket_id: '3',
      created_date: new Date('2025-03-06').toISOString(),
      resolved_date: undefined,
      duration: 137.11,
      reopen_count: 2,
      reassignment_count: 0,
      short_description: 'VPN connection fails for a remote worker.',
      work_notes: 'Validated VPN credentials, restarted the gateway, and restored remote access after confirming the tunnel negotiated successfully.',
      made_sla: true,
      fcr: true,
      requester_id: 14,
      assigned_to_id: 7,
      closed_by_id: 7,
      assignment_group_id: 5,
      priority_id: 2,
      impact_id: 2,
      urgency_id: 2,
      status_id: 2,
      category_id: 1,
      channel_id: 1,
      source_id: 1,
      sla_id: 2,
      sla_duedate: new Date('2025-03-06').toISOString()
    },
    {
      ticket_id: '4',
      created_date: new Date('2025-02-20').toISOString(),
      resolved_date: undefined,
      duration: 151.52,
      reopen_count: 4,
      reassignment_count: 0,
      short_description: 'User account locked after multiple failed login attempts.',
      work_notes: 'Unlocked the account, reset the password, and confirmed the user could complete the next login with MFA.',
      made_sla: true,
      fcr: false,
      requester_id: 15,
      assigned_to_id: 8,
      closed_by_id: 8,
      assignment_group_id: 1,
      priority_id: 3,
      impact_id: 3,
      urgency_id: 1,
      status_id: 2,
      category_id: 7,
      channel_id: 3,
      source_id: 1,
      sla_id: 3,
      sla_duedate: new Date('2025-02-20').toISOString()
    },
    {
      ticket_id: '5',
      created_date: new Date('2025-11-14').toISOString(),
      resolved_date: new Date('2021-12-11').toISOString(),
      duration: 130.56,
      reopen_count: 2,
      reassignment_count: 0,
      short_description: 'Network performance drops when accessing the file server.',
      work_notes: 'Investigated the LAN switch configuration, cleared stale ARP entries, and verified that file server traffic returned to normal.',
      made_sla: true,
      fcr: true,
      requester_id: 16,
      assigned_to_id: 9,
      closed_by_id: 9,
      assignment_group_id: 3,
      priority_id: 2,
      impact_id: 4,
      urgency_id: 3,
      status_id: 3,
      category_id: 1,
      channel_id: 1,
      source_id: 1,
      sla_id: 2,
      sla_duedate: new Date('2021-12-11').toISOString()
    },
    {
      ticket_id: '6',
      created_date: new Date('2025-04-19').toISOString(),
      resolved_date: undefined,
      duration: 151.67,
      reopen_count: 2,
      reassignment_count: 0,
      short_description: 'Branch Wi-Fi disconnects during peak hours.',
      work_notes: 'Identified an overloaded access point, redistributed the SSID across additional radios, and monitored the branch for improved stability.',
      made_sla: true,
      fcr: true,
      requester_id: 17,
      assigned_to_id: 6,
      closed_by_id: 6,
      assignment_group_id: 1,
      priority_id: 2,
      impact_id: 2,
      urgency_id: 2,
      status_id: 2,
      category_id: 1,
      channel_id: 3,
      source_id: 1,
      sla_id: 2,
      sla_duedate: new Date('2025-04-19').toISOString()
    },
    {
      ticket_id: '7',
      created_date: new Date('2025-05-14').toISOString(),
      resolved_date: undefined,
      duration: 26.49,
      reopen_count: 0,
      reassignment_count: 0,
      short_description: 'Password reset link failed for an expired account.',
      work_notes: 'Validated the reset workflow, manually reset the password, and confirmed the user could log in successfully.',
      made_sla: true,
      fcr: false,
      requester_id: 18,
      assigned_to_id: 8,
      closed_by_id: 8,
      assignment_group_id: 1,
      priority_id: 3,
      impact_id: 3,
      urgency_id: 1,
      status_id: 1,
      category_id: 7,
      channel_id: 2,
      source_id: 1,
      sla_id: 3,
      sla_duedate: new Date('2025-05-14').toISOString()
    },
    {
      ticket_id: '8',
      created_date: new Date('2023-01-22').toISOString(),
      resolved_date: new Date('2023-01-22').toISOString(),
      duration: 29.48,
      reopen_count: 2,
      reassignment_count: 0,
      short_description: 'Printer not responding after firmware update.',
      work_notes: 'Rolled back the printer firmware, cleared the print queue, and restored service to the impacted department.',
      made_sla: true,
      fcr: true,
      requester_id: 19,
      assigned_to_id: 10,
      closed_by_id: 10,
      assignment_group_id: 4,
      priority_id: 2,
      impact_id: 4,
      urgency_id: 2,
      status_id: 3,
      category_id: 2,
      channel_id: 3,
      source_id: 4,
      sla_id: 2,
      sla_duedate: new Date('2023-01-22').toISOString()
    },
    {
      ticket_id: '9',
      created_date: new Date('2020-07-26').toISOString(),
      resolved_date: undefined,
      duration: 143.74,
      reopen_count: 0,
      reassignment_count: 0,
      short_description: 'Application install fails due to missing dependencies.',
      work_notes: 'Installed the missing runtime packages, retried the installer, and confirmed the software launch on the user\'s workstation.',
      made_sla: true,
      fcr: true,
      requester_id: 20,
      assigned_to_id: 11,
      closed_by_id: 11,
      assignment_group_id: 3,
      priority_id: 2,
      impact_id: 2,
      urgency_id: 2,
      status_id: 2,
      category_id: 2,
      channel_id: 1,
      source_id: 1,
      sla_id: 2,
      sla_duedate: new Date('2020-07-27').toISOString()
    },
    {
      ticket_id: '10',
      created_date: new Date('2025-09-10').toISOString(),
      resolved_date: undefined,
      duration: 37.01,
      reopen_count: 4,
      reassignment_count: 1,
      short_description: 'Software update crashes on startup.',
      work_notes: 'Collected crash logs, applied the vendor patch, and verified the application opened successfully after remediation.',
      made_sla: true,
      fcr: false,
      requester_id: 21,
      assigned_to_id: 5,
      closed_by_id: 5,
      assignment_group_id: 3,
      priority_id: 2,
      impact_id: 3,
      urgency_id: 2,
      status_id: 1,
      category_id: 2,
      channel_id: 1,
      source_id: 1,
      sla_id: 2,
      sla_duedate: new Date('2025-09-10').toISOString()
    },
    {
      ticket_id: '11',
      created_date: new Date('2025-09-18').toISOString(),
      resolved_date: undefined,
      duration: 185.42,
      reopen_count: 1,
      reassignment_count: 1,
      short_description: 'Printer service request escalated after multiple follow-ups.',
      work_notes: 'Customer still waiting. Reset printer settings and re-routed through support queue.',
      made_sla: false,
      fcr: false,
      requester_id: 12,
      assigned_to_id: 9,
      closed_by_id: 9,
      assignment_group_id: 2,
      priority_id: 2,
      impact_id: 3,
      urgency_id: 2,
      status_id: 2,
      category_id: 4,
      channel_id: 2,
      source_id: 1,
      sla_id: 2,
      sla_duedate: new Date('2025-09-19').toISOString()
    },
    {
      ticket_id: '12',
      created_date: new Date('2025-08-22').toISOString(),
      resolved_date: undefined,
      duration: 210.95,
      reopen_count: 2,
      reassignment_count: 0,
      short_description: 'Server access issue with repeated credential resets.',
      work_notes: 'User re-opened ticket twice. Escalated to senior support due to failed login validation.',
      made_sla: false,
      fcr: false,
      requester_id: 13,
      assigned_to_id: 11,
      closed_by_id: 11,
      assignment_group_id: 2,
      priority_id: 1,
      impact_id: 3,
      urgency_id: 3,
      status_id: 1,
      category_id: 1,
      channel_id: 1,
      source_id: 1,
      sla_id: 1,
      sla_duedate: new Date('2025-08-22').toISOString()
    },
    {
      ticket_id: '13',
      created_date: new Date('2025-10-02').toISOString(),
      resolved_date: undefined,
      duration: 98.3,
      reopen_count: 0,
      reassignment_count: 2,
      short_description: 'Server patching failed after reboot, causing service outage.',
      work_notes: 'Patch failed on restart, support team re-applied update and verified system health.',
      made_sla: false,
      fcr: false,
      requester_id: 14,
      assigned_to_id: 9,
      closed_by_id: 9,
      assignment_group_id: 2,
      priority_id: 2,
      impact_id: 2,
      urgency_id: 2,
      status_id: 6,
      category_id: 1,
      channel_id: 2,
      source_id: 4,
      sla_id: 2,
      sla_duedate: new Date('2025-10-03').toISOString()
    },
    {
      ticket_id: '14',
      created_date: new Date('2025-10-09').toISOString(),
      resolved_date: undefined,
      duration: 245.0,
      reopen_count: 3,
      reassignment_count: 1,
      short_description: 'Repeated server downtime due to failing RAID controller.',
      work_notes: 'Replaced controller and rebuilt array; ongoing monitoring continues.',
      made_sla: false,
      fcr: false,
      requester_id: 15,
      assigned_to_id: 11,
      closed_by_id: 11,
      assignment_group_id: 2,
      priority_id: 1,
      impact_id: 1,
      urgency_id: 1,
      status_id: 2,
      category_id: 3,
      channel_id: 1,
      source_id: 1,
      sla_id: 1,
      sla_duedate: new Date('2025-10-10').toISOString()
    }
  ];

  return quatroTickets;
};

// Initialize on first load with real Quatro_Data
tickets = initializeQuatroData();
weeklyCounts = calculateWeeklyCounts(tickets);

// ============= DATA LOADING =============
export const loadTicketsFromCSVString = (csvContent: string) => {
  const parsedTickets = parseCSVData(csvContent);
  const parsedWeekly = calculateWeeklyCounts(parsedTickets);
  return { tickets: parsedTickets, weeklyCounts: parsedWeekly };
};

export const setTickets = (newTickets: Ticket[]) => {
  tickets = newTickets;
  weeklyCounts = calculateWeeklyCounts(newTickets);
};

// ============= LOOKUP HELPERS =============
export const getPriorityById = (id: number) => priorities.find(p => p.priority_id === id);
export const getPriorityByLevel = (level: string) => priorities.find(p => p.priority_level.toLowerCase() === level.toLowerCase());

export const getImpactById = (id: number) => impacts.find(i => i.impact_id === id);
export const getUrgencyById = (id: number) => urgencies.find(u => u.urgency_id === id);

export const getAssignmentGroupById = (id: number) => assignmentGroups.find(g => g.assignment_group_id === id);
export const getAssignmentGroupByName = (name: string) => assignmentGroups.find(g => g.group_name.toLowerCase() === name.toLowerCase());

export const getStatusById = (id: number) => statuses.find(s => s.status_id === id);
export const getSubStatusById = (id: number) => subStatuses.find(ss => ss.sub_status_id === id);

export const getCategoryById = (id: number) => categories.find(c => c.category_id === id);
export const getCategoryByName = (name: string) => categories.find(c => c.category_name.toLowerCase() === name.toLowerCase());

export const getChannelById = (id: number) => channels.find(ch => ch.channel_id === id);
export const getSourceById = (id: number) => sources.find(s => s.source_id === id);
export const getConfigItemById = (id: number) => configurationItems.find(ci => ci.config_item_id === id);
export const getSLAById = (id: number) => slas.find(s => s.sla_id === id);

export const getUserById = (id: number) => users.find(u => u.user_id === id);
export const getUserByEmail = (email: string) => users.find(u => u.email.toLowerCase() === email.toLowerCase());
export const getUserByName = (name: string) => {
  if (!name) return undefined;
  const n = String(name).trim();
  if (!n) return undefined;

  // Try exact email-like lookup first
  const byEmail = users.find(u => (u.email || '').toLowerCase() === n.toLowerCase());
  if (byEmail) return byEmail;

  // Handle "Last, First" or "First Last"
  const parts = n.split(',').map(p => p.trim());
  if (parts.length === 2) {
    const last = parts[0].toLowerCase();
    const first = parts[1].toLowerCase();
    return users.find(u => u.last_name?.toLowerCase() === last && u.first_name?.toLowerCase() === first);
  }

  // Match tokens against full name
  const tokens = n.toLowerCase().split(/\s+/).filter(Boolean);
  return users.find(u => {
    const full = `${u.first_name} ${u.last_name}`.toLowerCase();
    const alt = `${u.last_name} ${u.first_name}`.toLowerCase();
    return tokens.every(t => full.includes(t) || alt.includes(t));
  });
};
export const getRoleById = (id: number) => roles.find(r => r.role_id === id);
