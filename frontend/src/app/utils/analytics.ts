import { tickets as seedDataTickets, priorities as seedPriorities } from '../data/seedData';

export interface KPIMetrics {
  slaCompliance: number;
  fcrRate: number;
  medianResolutionTime: number;
  reopenRate: number;
  totalTickets: number;
  resolvedTickets: number;
}

export interface GroupPerformance {
  groupId: number;
  totalTickets: number;
  slaCompliance: number;
  fcrRate: number;
  avgResolutionTime: number;
  reopenRate: number;
}

export interface NonFCRTicket {
  ticket_id: string;
  priority_id: number;
  category_id: number;
  assignment_group_id?: number;
  created_date: string;
  opened_at: string;
  status_id: number;
}

export interface EmployeePerformance {
  userId: number;
  assignmentGroupId?: number;
  ticketsResolved: number;
  avgResolutionTime: number;
  fcrRate: number;
  satisfactionScore: number;
}

export interface ProductivityTrend {
  groupId: number;
  week: string;
  ticketCount: number;
  avgResolutionTime: number;
}

export const calculateKPIs = (ticketData?: any[]): KPIMetrics => {
  const ticketsToUse = ticketData !== undefined ? ticketData : seedDataTickets;
  const totalTickets = ticketsToUse.length;
  const slaMetCount = ticketsToUse.filter(t => t.made_sla === true).length;
  const fcrCount = ticketsToUse.filter(t => t.fcr === true).length;
  const reopenedCount = ticketsToUse.filter(t => t.reopen_count > 0).length;
  const resolvedTickets = ticketsToUse.filter(t => t.status_id === 3 || t.status_id === 4);
  
  // Calculate median resolution time in hours
  const resolutionTimes = resolvedTickets
    .filter(t => t.duration !== undefined && t.duration !== null)
    .map(t => (t.duration as number) / 60) // Convert minutes to hours
    .sort((a, b) => a - b);
  
  const median = resolutionTimes.length > 0
    ? resolutionTimes[Math.floor(resolutionTimes.length / 2)]
    : 0;

  return {
    slaCompliance: totalTickets > 0 ? (slaMetCount / totalTickets) * 100 : 0,
    fcrRate: totalTickets > 0 ? (fcrCount / totalTickets) * 100 : 0,
    medianResolutionTime: median,
    reopenRate: totalTickets > 0 ? (reopenedCount / totalTickets) * 100 : 0,
    totalTickets,
    resolvedTickets: resolvedTickets.length
  };
};

export const getTicketsByPriority = (ticketData?: any[]) => {
  const ticketsToUse = ticketData !== undefined ? ticketData : seedDataTickets;
  const priorityCounts = ticketsToUse.reduce((acc, ticket) => {
    acc[ticket.priority_id] = (acc[ticket.priority_id] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  return Object.entries(priorityCounts).map(([id, count]) => {
    const priorityId = parseInt(id);
    const priority = seedPriorities.find(p => p.priority_id === priorityId);
    return {
      priorityId,
      priority: priority?.priority_level || `Priority ${priorityId}`,
      count
    };
  });
};

export const getTicketsByAssignmentGroup = (ticketData?: any[]) => {
  const ticketsToUse = ticketData !== undefined ? ticketData : seedDataTickets;
  const groupCounts = ticketsToUse.reduce((acc, ticket) => {
    if (ticket.assignment_group_id) {
      acc[ticket.assignment_group_id] = (acc[ticket.assignment_group_id] || 0) + 1;
    }
    return acc;
  }, {} as Record<number, number>);

  return Object.entries(groupCounts).map(([id, count]) => ({
    groupId: parseInt(id),
    count
  }));
};

/**
 * Returns non-FCR tickets with category information
 */
export const getNonFCRTickets = (ticketData?: any[]): NonFCRTicket[] => {
  const ticketsToUse = ticketData !== undefined ? ticketData : seedDataTickets;
  return ticketsToUse
    .filter(t => !t.fcr)
    .map(t => ({
      ticket_id: t.ticket_id,
      priority_id: t.priority_id,
      category_id: t.category_id,
      assignment_group_id: t.assignment_group_id,
      created_date: t.created_date,
      opened_at: t.opened_at ?? t.created_date,
      status_id: t.status_id
    }))
    .sort((a, b) => {
      // Sort by priority first (lower ID = higher priority)
      if (a.priority_id !== b.priority_id) {
        return a.priority_id - b.priority_id;
      }
      // Then by age (created_date)
      return new Date(a.created_date).getTime() - new Date(b.created_date).getTime();
    })
    .slice(0, 20); // Top 20
};

export const getTicketsByCategory = (ticketData?: any[]) => {
  const ticketsToUse = ticketData !== undefined ? ticketData : seedDataTickets;
  const categoryCounts = ticketsToUse.reduce((acc, ticket) => {
    acc[ticket.category_id] = (acc[ticket.category_id] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  return Object.entries(categoryCounts).map(([id, count]) => ({
    categoryId: parseInt(id),
    count
  }));
};

/**
 * Returns performance metrics for each assignment group
 */
export const getAssignmentGroupPerformance = (ticketData?: any[]): GroupPerformance[] => {
  const ticketsToUse = ticketData !== undefined ? ticketData : seedDataTickets;
  const groupData = ticketsToUse.reduce((acc, ticket) => {
    const groupId = ticket.assignment_group_id || 0;
    if (!acc[groupId]) {
      acc[groupId] = {
        totalTickets: 0,
        resolvedTickets: 0,
        slaMetCount: 0,
        fcrCount: 0,
        reopenCount: 0,
        totalResolutionTime: 0
      };
    }
    
    acc[groupId].totalTickets++;
    if (ticket.status_id === 3 || ticket.status_id === 4) {
      acc[groupId].resolvedTickets++;
    }
    if (ticket.made_sla === true) {
      acc[groupId].slaMetCount++;
    }
    if (ticket.fcr) {
      acc[groupId].fcrCount++;
    }
    if (ticket.reopen_count > 0) {
      acc[groupId].reopenCount++;
    }
    if (ticket.duration !== undefined && ticket.duration !== null) {
      acc[groupId].totalResolutionTime += ticket.duration;
    }
    
    return acc;
  }, {} as Record<number, any>);

  return Object.entries(groupData)
    .filter(([id]) => parseInt(id) !== 0) // Exclude unassigned
    .map(([id, data]) => ({
      groupId: parseInt(id),
      totalTickets: data.totalTickets,
      slaCompliance: data.totalTickets > 0 ? (data.slaMetCount / data.totalTickets) * 100 : 0,
      fcrRate: data.totalTickets > 0 ? (data.fcrCount / data.totalTickets) * 100 : 0,
      avgResolutionTime: data.resolvedTickets > 0 
        ? (data.totalResolutionTime / data.resolvedTickets / 60)  // Convert to hours
        : 0,
      reopenRate: data.totalTickets > 0 ? (data.reopenCount / data.totalTickets) * 100 : 0
    }));
};

/**
 * Calculates employee satisfaction based on FCR and SLA compliance
 */
export const calculateEmployeeSatisfaction = (ticketData?: any[]): number => {
  const kpis = calculateKPIs(ticketData);
  // Weighted average: 60% SLA, 40% FCR
  return (kpis.slaCompliance * 0.6 + kpis.fcrRate * 0.4) / 100 * 5.0;
};

/**
 * Calculates productivity trend compared to previous period
 */
export const calculateProductivityTrend = (ticketData?: any[]): number => {
  const ticketsToUse = ticketData !== undefined ? ticketData : seedDataTickets;
  if (ticketsToUse.length === 0) return 0;
  
  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  
  const currentPeriod = ticketsToUse.filter(t => new Date(t.created_date) >= twoWeeksAgo).length;
  const previousPeriod = ticketsToUse.filter(t => {
    const d = new Date(t.created_date);
    return d >= fourWeeksAgo && d < twoWeeksAgo;
  }).length;
  
  if (previousPeriod === 0) return 0;
  return ((currentPeriod - previousPeriod) / previousPeriod) * 100;
};

/**
 * Determines if workforce optimization or additional staff is needed
 */
export const getOptimizationNeeds = (ticketData?: any[]) => {
  const groupPerformance = getAssignmentGroupPerformance(ticketData);
  const kpis = calculateKPIs(ticketData);
  
  const needsOptimization = {
    needsTraining: kpis.fcrRate < 70,
    needsMoreStaff: kpis.slaCompliance < 80,
    needsProcessReview: kpis.reopenRate > 10,
    metricsAlerts: [] as string[]
  };
  
  // Check underperforming groups
  groupPerformance.forEach(group => {
    if (group.fcrRate < 65) {
      needsOptimization.metricsAlerts.push(
        `Group ${group.groupId}: Low FCR rate (${group.fcrRate.toFixed(1)}%)`
      );
    }
    if (group.slaCompliance < 75) {
      needsOptimization.metricsAlerts.push(
        `Group ${group.groupId}: SLA compliance below target (${group.slaCompliance.toFixed(1)}%)`
      );
    }
  });
  
  return needsOptimization;
};

/**
 * Gets tickets by status for task allocation view
 */
export const getTicketsByStatus = (status_id: number, ticketData?: any[]) => {
  const ticketsToUse = ticketData !== undefined ? ticketData : seedDataTickets;
  return ticketsToUse.filter(t => t.status_id === status_id);
};

export const getNewTickets = (ticketData?: any[]) => getTicketsByStatus(1, ticketData);
export const getInProgressTickets = (ticketData?: any[]) => getTicketsByStatus(2, ticketData);
export const getResolvedTickets = (ticketData?: any[]) => getTicketsByStatus(3, ticketData);
export const getClosedTickets = (ticketData?: any[]) => getTicketsByStatus(4, ticketData);
export const getPendingTickets = (ticketData?: any[]) => getTicketsByStatus(5, ticketData);

/**
 * Compute per-employee performance metrics using `assigned_to_id` and `closed_by_id`.
 */
export const getEmployeePerformance = (ticketData?: any[]): EmployeePerformance[] => {
  const ticketsToUse = ticketData !== undefined ? ticketData : seedDataTickets;
  const map = {} as Record<number, {
    resolvedCount: number;
    totalResolutionTime: number;
    fcrCount: number;
    slaCount: number;
    ticketsAssigned: number;
  }>;

  ticketsToUse.forEach(t => {
    const recordResolved = (id: number | undefined) => {
      if (!id) return;
      if (!map[id]) map[id] = { resolvedCount: 0, totalResolutionTime: 0, fcrCount: 0, slaCount: 0, ticketsAssigned: 0 };
      if (t.status_id === 3 || t.status_id === 4) {
        map[id].resolvedCount++;
        if (t.duration) map[id].totalResolutionTime += t.duration;
        if (t.fcr) map[id].fcrCount++;
        if (t.made_sla) map[id].slaCount++;
      }
    };

    if (t.assigned_to_id) {
      if (!map[t.assigned_to_id]) map[t.assigned_to_id] = { resolvedCount: 0, totalResolutionTime: 0, fcrCount: 0, slaCount: 0, ticketsAssigned: 0 };
      map[t.assigned_to_id].ticketsAssigned++;
    }

    // Credit both assigned and closer for resolved work
    recordResolved(t.assigned_to_id);
    recordResolved(t.closed_by_id);
  });

  return Object.entries(map).map(([uid, stats]) => {
    const resolved = stats.resolvedCount;
    const avgResolution = resolved > 0 ? (stats.totalResolutionTime / resolved) / 60 : 0; // hours
    const fcrRate = resolved > 0 ? (stats.fcrCount / resolved) * 100 : 0;
    const slaRate = resolved > 0 ? (stats.slaCount / resolved) * 100 : 0;
    const satisfaction = resolved > 0 ? ((slaRate * 0.6 + fcrRate * 0.4) / 100) * 5.0 : 0;

    return {
      userId: parseInt(uid),
      assignmentGroupId: undefined,
      ticketsResolved: resolved,
      avgResolutionTime: avgResolution,
      fcrRate,
      satisfactionScore: satisfaction
    } as EmployeePerformance;
  });
};

/**
 * Return top agents sorted by tickets resolved
 */
export const getTopAgents = (ticketData?: any[], topN = 10) => {
  return getEmployeePerformance(ticketData).sort((a, b) => b.ticketsResolved - a.ticketsResolved).slice(0, topN);
};
