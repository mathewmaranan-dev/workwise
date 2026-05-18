import { Ticket } from '../data/seedData';

/**
 * Machine Learning utilities for ITSM predictions and recommendations
 */

// ============= TICKET TREND PREDICTION =============

export interface TicketTrend {
  date: string;
  count: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  projection: number; // Predicted next value
}

/**
 * Simple moving average trend prediction
 */
export const predictTicketTrend = (tickets: Ticket[], days: number = 7): TicketTrend[] => {
  const now = new Date();
  const dailyCounts: Record<string, number> = {};

  // Count tickets per day
  tickets.forEach(ticket => {
    const date = new Date(ticket.created_date);
    const dateStr = date.toISOString().split('T')[0];
    dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + 1;
  });

  // Get last N days of data
  const trends: TicketTrend[] = [];
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const count = dailyCounts[dateStr] || 0;

    // Calculate trend using simple moving average
    const recentDays = Object.entries(dailyCounts)
      .filter(([d]) => {
        const diff = (new Date(dateStr).getTime() - new Date(d).getTime()) / (1000 * 60 * 60 * 24);
        return Math.abs(diff) <= 3;
      })
      .map(([, c]) => c)
      .sort((a, b) => a - b);

    const avgThreeDays = recentDays.length > 0 
      ? recentDays.reduce((a, b) => a + b, 0) / recentDays.length 
      : count;

    let trend: 'increasing' | 'decreasing' | 'stable';
    if (count > avgThreeDays * 1.2) {
      trend = 'increasing';
    } else if (count < avgThreeDays * 0.8) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    trends.push({
      date: dateStr,
      count,
      trend,
      projection: Math.round(avgThreeDays)
    });
  }

  return trends;
};

// ============= NON-FCR PREDICTION & FLAGS =============

export interface NonFCRRiskScore {
  ticket_id: string;
  riskScore: number; // 0-100
  factors: string[];
  recommendation: string;
}

/**
 * Predicts which tickets are likely to be non-FCR based on patterns
 */
export const predictNonFCRRisk = (tickets: Ticket[]): NonFCRRiskScore[] => {
  return tickets.map(ticket => {
    let score = 0;
    const factors: string[] = [];

    // High priority = higher non-FCR risk
    if (ticket.priority_id === 1) {
      score += 15;
      factors.push('Critical priority');
    } else if (ticket.priority_id === 2) {
      score += 10;
      factors.push('High priority');
    }

    // Complex categories more likely non-FCR
    if ([2, 3, 8].includes(ticket.category_id)) {
      score += 20;
      factors.push('Complexity (software/hardware/printer)');
    }

    // Already reopened tickets have high non-FCR risk
    if (ticket.reopen_count > 0) {
      score += 25;
      factors.push(`Already reopened ${ticket.reopen_count} time(s)`);
    }

    // Long resolution time indicates complexity
    if (ticket.duration && ticket.duration > 480) {
      score += 15;
      factors.push('Long resolution time');
    }

    // Assigned to multiple people = higher complexity
    if (ticket.reassignment_count > 0) {
      score += 10;
      factors.push(`Reassigned ${ticket.reassignment_count} time(s)`);
    }

    // Multiple work notes indicate back-and-forth
    if (ticket.work_notes && ticket.work_notes.split('\n').length > 3) {
      score += 10;
      factors.push('Multiple interactions');
    }

    let recommendation = 'Monitor ticket';
    if (score >= 70) {
      recommendation = 'HIGH RISK - Escalate to senior technician';
    } else if (score >= 50) {
      recommendation = 'MEDIUM RISK - Ensure thorough resolution';
    } else if (score >= 30) {
      recommendation = 'LOW RISK - Standard handling';
    }

    return {
      ticket_id: ticket.ticket_id,
      riskScore: Math.min(100, score),
      factors,
      recommendation
    };
  });
};

// ============= INTELLIGENT TASK ALLOCATION =============

export interface TaskAllocation {
  agent_id: number;
  tickets: string[]; // ticket IDs
  estimatedLoad: number; // hours
}

/**
 * Allocates new tickets to agents based on:
 * - Current workload
 * - Historical FCR rate
 * - Ticket complexity
 * - Agent expertise (by assignment group)
 */
export const allocateTasksIntelligently = (
  newTickets: Ticket[],
  agentPerformance: Record<number, { fcrRate: number; currentLoad: number; group_id: number }>,
  ticketCategoryExpertise: Record<number, Record<number, number>> // agent -> category -> expertise score
): TaskAllocation[] => {
  const allocations: TaskAllocation[] = [];

  // Sort agents by current load (ascending) and FCR rate (descending)
  const sortedAgents = Object.entries(agentPerformance)
    .sort(([, a], [, b]) => {
      const loadDiff = a.currentLoad - b.currentLoad;
      if (Math.abs(loadDiff) > 2) return loadDiff;
      return b.fcrRate - a.fcrRate;
    });

  // Allocate tickets using round-robin with load balancing
  newTickets.forEach((ticket, index) => {
    const [bestAgentId] = sortedAgents[index % sortedAgents.length];
    const agentId = parseInt(bestAgentId);

    if (!allocations.find(a => a.agent_id === agentId)) {
      allocations.push({ agent_id: agentId, tickets: [], estimatedLoad: 0 });
    }

    const allocation = allocations.find(a => a.agent_id === agentId)!;
    allocation.tickets.push(ticket.ticket_id);

    // Estimate load based on priority
    const baseHours = [2, 1.5, 1, 0.5][ticket.priority_id - 1] || 1;
    allocation.estimatedLoad += baseHours;
  });

  return allocations;
};

// ============= STAFFING & RESOURCE RECOMMENDATIONS =============

export interface StaffingRecommendation {
  metric: string;
  current: number;
  target: number;
  recommendation: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Analyzes ticket data to recommend staffing changes
 */
export const recommendStaffingChanges = (
  tickets: Ticket[],
  teamSize: number,
  fcrRate: number,
  slaCompliance: number
): StaffingRecommendation[] => {
  const recommendations: StaffingRecommendation[] = [];

  // Analyze SLA compliance
  if (slaCompliance < 80) {
    const deficit = 80 - slaCompliance;
    const staffIncrease = Math.ceil(teamSize * (deficit / 100));
    recommendations.push({
      metric: 'SLA Compliance',
      current: slaCompliance,
      target: 90,
      recommendation: `Increase team size by ${staffIncrease} members to improve SLA compliance`,
      priority: slaCompliance < 70 ? 'critical' : 'high'
    });
  }

  // Analyze FCR rate
  if (fcrRate < 75) {
    recommendations.push({
      metric: 'First Contact Resolution',
      current: fcrRate,
      target: 80,
      recommendation: 'Invest in knowledge base and training rather than increasing headcount',
      priority: 'medium'
    });
  }

  // Analyze workload distribution
  const avgTicketsPerDay = tickets.filter(t => {
    const age = (new Date().getTime() - new Date(t.created_date).getTime()) / (1000 * 60 * 60 * 24);
    return age <= 30;
  }).length / 30;
  
  const ticketsPerPersonPerDay = avgTicketsPerDay / (teamSize || 1);
  if (ticketsPerPersonPerDay > 10) {
    recommendations.push({
      metric: 'Workload per Agent',
      current: ticketsPerPersonPerDay,
      target: 8,
      recommendation: `Current workload is ${ticketsPerPersonPerDay.toFixed(1)} tickets/person/day. Add ${Math.ceil(teamSize * 0.25)} staff.`,
      priority: 'high'
    });
  }

  return recommendations;
};
