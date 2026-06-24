import { Ticket, getCategoryById } from '../data/seedData';

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

interface FcrPredictionPayload {
  assignment_group_id: number;
  assigned_to_id: number;
  category_id: number;
  subcategory_id: string | number;
  priority_id: number;
  impact_id: number;
  urgency_id: number;
  channel_id: number;
  source_id: number;
  reopen_count: number;
  reassignment_count: number;
  duration: number;
  ticket_complexity: number;
  agent_fcr_history: number;
  category_non_fcr_rate: number;
}

const clampValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toFiniteNumber = (value: any, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildFcrPredictionPayload = (ticket: Ticket, tickets: Ticket[] = seedDataTickets): FcrPredictionPayload => {
  const assignment_group_id = toFiniteNumber(ticket.assignment_group_id, 1);
  const assigned_to_id = toFiniteNumber(ticket.assigned_to_id, 1);
  const category_id = toFiniteNumber(ticket.category_id, 1);
  const priority_id = toFiniteNumber(ticket.priority_id, 3);
  const impact_id = toFiniteNumber(ticket.impact_id, 3);
  const urgency_id = toFiniteNumber(ticket.urgency_id, 2);
  const channel_id = toFiniteNumber(ticket.channel_id, 1);
  const source_id = toFiniteNumber(ticket.source_id, 1);
  const duration = toFiniteNumber(ticket.duration, 120);
  const reopen_count = toFiniteNumber(ticket.reopen_count, 0);
  const reassignment_count = toFiniteNumber(ticket.reassignment_count, 0);

  const agentTickets = tickets.filter(t => t.assigned_to_id === assigned_to_id && t.ticket_id !== ticket.ticket_id);
  const agentFcrHistory = agentTickets.length > 0
    ? agentTickets.filter(t => t.fcr).length / agentTickets.length
    : 0.7;

  const categoryTickets = tickets.filter(t => t.category_id === category_id && t.ticket_id !== ticket.ticket_id);
  const categoryNonFcrRate = categoryTickets.length > 0
    ? categoryTickets.filter(t => !t.fcr).length / categoryTickets.length
    : 0.3;

  const complexityBase =
    (priority_id - 1) * 1.5 +
    (impact_id - 1) * 1.2 +
    (urgency_id - 1) * 1.0 +
    reopen_count * 1.8 +
    reassignment_count * 1.6 +
    clampValue((duration - 60) / 120, 0, 4);

  const categoryName = (getCategoryById(category_id)?.category_name || 'software').toLowerCase();

  return {
    assignment_group_id,
    assigned_to_id,
    category_id,
    subcategory_id: ticket.subcategory_id ?? 'missing',
    priority_id,
    impact_id,
    urgency_id,
    channel_id,
    source_id,
    reopen_count,
    reassignment_count,
    duration,
    ticket_complexity: clampValue(Math.round(complexityBase), 1, 12),
    agent_fcr_history: clampValue(Math.round(agentFcrHistory * 1000) / 1000, 0, 1),
    category_non_fcr_rate: clampValue(Math.round(categoryNonFcrRate * 1000) / 1000, 0, 1),
  } as FcrPredictionPayload;
};

const predictNonFCRRiskLocal = (tickets: Ticket[]): NonFCRRiskScore[] => {
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

export const predictNonFCRRisk = async (tickets: Ticket[], allTickets: Ticket[] = seedDataTickets): Promise<NonFCRRiskScore[]> => {
  if (!tickets || tickets.length === 0) {
    return [];
  }

  const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';
  const mlApiBase = (import.meta as any).env?.VITE_ML_API_URL || apiBase;
  const backendEndpoint = `${apiBase.replace(/\/$/, '')}/api/ml/fcr/predict`;
  const directMlEndpoint = `${mlApiBase.replace(/\/$/, '')}/api/ml/fcr/predict`;

  const predictions = await Promise.all(
    tickets.map(async (ticket) => {
      const payload = buildFcrPredictionPayload(ticket, allTickets);
      const mlPayload = {
        ticket_category: (getCategoryById(ticket.category_id ?? 1)?.category_name || 'software').toLowerCase(),
        category_id: payload.category_id,
        priority: payload.priority_id,
        assigned_group: payload.assignment_group_id,
        assignment_group_id: payload.assignment_group_id,
        assigned_to_id: payload.assigned_to_id,
        impact_id: payload.impact_id,
        urgency_id: payload.urgency_id,
        reopen_count: payload.reopen_count,
        reassignment_count: payload.reassignment_count,
        duration: payload.duration,
        ticket_complexity: payload.ticket_complexity,
        agent_fcr_history: payload.agent_fcr_history,
        category_non_fcr_rate: payload.category_non_fcr_rate,
      };

      try {
        const response = await fetch(backendEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(mlPayload)
        });

        if (!response.ok) {
          throw new Error(`ML service responded with status ${response.status}`);
        }

        const data = await response.json();
        const riskData = data?.fcr_risk;

        if (!riskData || typeof riskData.risk_score !== 'number') {
          throw new Error('Unexpected ML service response');
        }

        return {
          ticket_id: ticket.ticket_id,
          riskScore: Math.min(100, Math.round(riskData.risk_score * 100)),
          factors: Array.isArray(riskData.drivers) ? riskData.drivers : [],
          recommendation: Array.isArray(riskData.recommendations) ? riskData.recommendations.join(' • ') : 'Monitor ticket'
        };
      } catch (error) {
        console.warn('FCR model request failed on backend endpoint, trying direct ML service:', error);

        try {
          const fallbackResponse = await fetch(directMlEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(mlPayload)
          });

          if (!fallbackResponse.ok) {
            throw new Error(`Direct ML service responded with status ${fallbackResponse.status}`);
          }

          const fallbackData = await fallbackResponse.json();
          const fallbackRiskData = fallbackData?.fcr_risk;

          if (!fallbackRiskData || typeof fallbackRiskData.risk_score !== 'number') {
            throw new Error('Unexpected direct ML service response');
          }

          return {
            ticket_id: ticket.ticket_id,
            riskScore: Math.min(100, Math.round(fallbackRiskData.risk_score * 100)),
            factors: Array.isArray(fallbackRiskData.drivers) ? fallbackRiskData.drivers : [],
            recommendation: Array.isArray(fallbackRiskData.recommendations) ? fallbackRiskData.recommendations.join(' • ') : 'Monitor ticket'
          };
        } catch (fallbackError) {
          console.warn('Direct ML service fallback failed; returning unavailable ML risk result:', fallbackError);
          return {
            ticket_id: ticket.ticket_id,
            riskScore: 0,
            factors: ['ML prediction unavailable'],
            recommendation: 'ML prediction unavailable',
          };
        }
      }
    })
  );

  return predictions;
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
