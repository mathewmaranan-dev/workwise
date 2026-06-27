/**
 * Team Filtering Utilities
 * 
 * Frontend-side filtering for dashboard data by assignment group.
 * NO changes to backend or ML services - only consumes existing API responses.
 */

import { Ticket } from '../data/seedData';

/**
 * Filter tickets by assignment group
 * @param tickets - Array of tickets
 * @param teamId - Assignment group ID (null = all teams)
 * @returns Filtered tickets
 */
export const filterTicketsByTeam = (tickets: any[], teamId: number | null): any[] => {
  if (!Array.isArray(tickets) || teamId === null) {
    return tickets;
  }
  return tickets.filter(ticket => Number(ticket.assignment_group_id) === teamId);
};

/**
 * Filter KPI metrics by team
 * @param kpis - KPI object with metrics
 * @param teamId - Assignment group ID
 * @returns Filtered KPIs (if applicable)
 */
export const filterKPIsByTeam = (kpis: any, teamId: number | null): any => {
  if (!kpis || teamId === null) {
    return kpis;
  }
  
  // KPIs might already be team-specific from the backend
  // If they contain an assignment_group_id field, validate it matches
  if (kpis.assignment_group_id && Number(kpis.assignment_group_id) !== teamId) {
    return null;
  }
  
  return kpis;
};

/**
 * Filter employee/user list by team
 * @param users - Array of users
 * @param teamId - Assignment group ID
 * @returns Filtered users assigned to the team
 */
export const filterUsersByTeam = (users: any[], teamId: number | null): any[] => {
  if (!Array.isArray(users) || teamId === null) {
    return users;
  }
  return users.filter(user => user.assignment_group_id === teamId);
};

/**
 * Filter chart data by team
 * Useful for bar charts showing team performance
 * @param chartData - Array of data points with assignment_group_id
 * @param teamId - Assignment group ID
 * @returns Filtered chart data
 */
export const filterChartDataByTeam = (chartData: any[], teamId: number | null): any[] => {
  if (!Array.isArray(chartData) || teamId === null) {
    return chartData;
  }
  
  return chartData.filter(item => {
    // Handle various field name conventions
    const groupId = item.assignment_group_id || item.group_id || item.teamId;
    return Number(groupId) === teamId;
  });
};

/**
 * Filter workload data by team
 * @param workloadData - Array with employee workload info
 * @param teamId - Assignment group ID
 * @returns Filtered workload data
 */
export const filterWorkloadByTeam = (workloadData: any[], teamId: number | null): any[] => {
  if (!Array.isArray(workloadData) || teamId === null) {
    return workloadData;
  }
  
  return workloadData.filter(item => {
    const groupId = item.assignment_group_id || item.group_id;
    return Number(groupId) === teamId;
  });
};

/**
 * Filter staffing/team member metrics
 * @param metrics - Array of team member metrics
 * @param teamId - Assignment group ID
 * @returns Filtered metrics for the team
 */
export const filterTeamMetricsByTeam = (metrics: any[], teamId: number | null): any[] => {
  if (!Array.isArray(metrics) || teamId === null) {
    return metrics;
  }
  
  return metrics.filter(metric => 
    Number(metric.assignment_group_id || metric.group_id) === teamId
  );
};

/**
 * Aggregate data for "All Teams" view
 * Calculate totals and averages across all teams
 * @param tickets - Array of all tickets
 * @param teams - Array of assignment groups
 * @returns Aggregated data
 */
export const aggregateDataAcrossTeams = (tickets: any[], teams: any[]) => {
  const result: Record<number, any> = {};
  
  teams.forEach(team => {
    const teamTickets = tickets.filter(t => Number(t.assignment_group_id) === team.assignment_group_id);
    result[team.assignment_group_id] = {
      team_id: team.assignment_group_id,
      team_name: team.group_name,
      ticket_count: teamTickets.length,
      resolved_count: teamTickets.filter((t: any) => t.status_id === 3 || t.status_id === 4).length,
      fcr_count: teamTickets.filter((t: any) => t.fcr).length,
      sla_met: teamTickets.filter((t: any) => t.made_sla).length,
    };
  });
  
  return result;
};

/**
 * Calculate team-specific KPIs from filtered tickets
 * @param tickets - Array of tickets for the team
 * @returns Object with KPI values
 */
export const calculateTeamKPIs = (tickets: any[]) => {
  if (!Array.isArray(tickets) || tickets.length === 0) {
    return {
      total_tickets: 0,
      resolved_tickets: 0,
      fcr_rate: 0,
      sla_compliance: 0,
      reopen_rate: 0,
      avg_resolution_time: 0,
    };
  }
  
  const total = tickets.length;
  const resolved = tickets.filter(t => t.status_id === 3 || t.status_id === 4).length;
  const fcr = tickets.filter(t => t.fcr).length;
  const slaMet = tickets.filter(t => t.made_sla).length;
  const reopens = tickets.reduce((sum, t) => sum + (t.reopen_count || 0), 0);
  const avgDuration = tickets.reduce((sum, t) => sum + (t.duration || 0), 0) / total;
  
  return {
    total_tickets: total,
    resolved_tickets: resolved,
    fcr_rate: total > 0 ? (fcr / total) * 100 : 0,
    sla_compliance: total > 0 ? (slaMet / total) * 100 : 0,
    reopen_rate: total > 0 ? (reopens / total) * 100 : 0,
    avg_resolution_time: avgDuration,
  };
};

/**
 * Create a filtered dataset for recommendations
 * Filters strategic actions, staffing recommendations, etc. by team
 * @param recommendations - Array of recommendation objects
 * @param teamId - Assignment group ID
 * @returns Filtered recommendations
 */
export const filterRecommendationsByTeam = (recommendations: any[], teamId: number | null): any[] => {
  if (!Array.isArray(recommendations) || teamId === null) {
    return recommendations;
  }
  
  return recommendations.filter(rec => {
    // Handle multiple field name conventions
    const recTeamId = rec.assignment_group_id || rec.group_id || rec.suggested_team || rec.suggestedTeam;
    if (typeof recTeamId === 'string') {
      // If it's a team name string, would need team name to ID mapping
      return true; // Let it pass, assume it's pre-filtered
    }
    return Number(recTeamId) === teamId;
  });
};

/**
 * Filter forecast data by team
 * @param forecastData - Forecast array or object
 * @param teamId - Assignment group ID
 * @returns Filtered forecast data
 */
export const filterForecastByTeam = (forecastData: any, teamId: number | null): any => {
  if (!forecastData || teamId === null) {
    return forecastData;
  }
  
  // If forecast is an array, filter by team_id
  if (Array.isArray(forecastData)) {
    return forecastData.filter(item => Number(item.assignment_group_id || item.group_id) === teamId);
  }
  
  // If forecast is an object with a team reference, validate it
  if (forecastData.assignment_group_id && Number(forecastData.assignment_group_id) !== teamId) {
    return null;
  }
  
  return forecastData;
};
