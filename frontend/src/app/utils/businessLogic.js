/**
 * Business Process Definitions for ITSM System
 * Defines SLA, Priority, Impact rules and calculations
 */
// ============= SLA DEFINITIONS =============
export const SLADefinitions = {
    critical: { name: 'Critical SLA', hours: 2, description: 'P1 Critical issues' },
    high: { name: 'High Priority SLA', hours: 4, description: 'P2 High priority issues' },
    medium: { name: 'Medium Priority SLA', hours: 8, description: 'P3 Medium priority issues' },
    low: { name: 'Low Priority SLA', hours: 24, description: 'P4 Low priority issues' }
};
// ============= PRIORITY DEFINITIONS =============
export const PriorityDefinitions = {
    1: {
        level: 'Critical',
        code: 'P1',
        slaHours: 2,
        description: 'System down, multiple users affected',
        color: 'red',
        responseTime: '15 minutes',
        resolutionTarget: '2 hours'
    },
    2: {
        level: 'High',
        code: 'P2',
        slaHours: 4,
        description: 'Major functionality impaired',
        color: 'orange',
        responseTime: '1 hour',
        resolutionTarget: '4 hours'
    },
    3: {
        level: 'Medium',
        code: 'P3',
        slaHours: 8,
        description: 'Minor functionality affected',
        color: 'yellow',
        responseTime: '4 hours',
        resolutionTarget: '8 hours'
    },
    4: {
        level: 'Low',
        code: 'P4',
        slaHours: 24,
        description: 'Cosmetic issues, general inquiries',
        color: 'blue',
        responseTime: '1 business day',
        resolutionTarget: '24 hours'
    }
};
// ============= IMPACT DEFINITIONS =============
export const ImpactDefinitions = {
    1: {
        level: 'Critical',
        description: 'Entire organization affected',
        affectedUsers: '100+',
        businessImpact: 'Complete service outage',
        color: 'red'
    },
    2: {
        level: 'High',
        description: 'Department or team affected',
        affectedUsers: '10-100',
        businessImpact: 'Significant disruption',
        color: 'orange'
    },
    3: {
        level: 'Medium',
        description: 'Group or function affected',
        affectedUsers: '2-10',
        businessImpact: 'Moderate impact',
        color: 'yellow'
    },
    4: {
        level: 'Low',
        description: 'Individual user affected',
        affectedUsers: '1',
        businessImpact: 'Limited impact',
        color: 'green'
    }
};
// ============= URGENCY DEFINITIONS =============
export const UrgencyDefinitions = {
    1: {
        level: 'High',
        description: 'User cannot work',
        responseTime: '15 minutes',
        color: 'red'
    },
    2: {
        level: 'Medium',
        description: 'User work is impeded',
        responseTime: '1 hour',
        color: 'orange'
    },
    3: {
        level: 'Low',
        description: 'User work can continue',
        responseTime: '4 hours',
        color: 'yellow'
    }
};
// ============= PERFORMANCE CALCULATIONS =============
/**
 * Determines if a team needs additional staff based on metrics
 */
export const evaluateStaffingNeeds = (totalTickets, fcrRate, slaCompliance, avgResolutionTime, teamSize) => {
    let score = 0;
    let needs = false;
    let severity = 'low';
    // Check SLA compliance
    if (slaCompliance < 80) {
        score += 2;
        needs = true;
        severity = 'high';
    }
    if (slaCompliance < 70) {
        score += 2;
        severity = 'critical';
    }
    // Check FCR rate
    if (fcrRate < 70) {
        score += 1;
        needs = true;
    }
    // Check workload per person
    const ticketsPerPerson = totalTickets / (teamSize || 1);
    if (ticketsPerPerson > 100) {
        score += 2;
        needs = true;
        severity = 'high';
    }
    // Check resolution time
    if (avgResolutionTime > 8) {
        score += 1;
        needs = true;
    }
    let recommendation = 'Current staffing levels are adequate';
    if (score >= 4) {
        recommendation = `URGENT: Increase team by 20-30% (${Math.ceil(teamSize * 0.25)} staff)`;
    }
    else if (score >= 2) {
        recommendation = `Consider adding ${Math.ceil(teamSize * 0.15)} staff to improve metrics`;
    }
    else if (score === 1) {
        recommendation = 'Monitor workload closely; may need additional support';
    }
    return { needsMoreStaff: needs, recommendation, severity };
};
/**
 * Calculates overall team performance score (0-100)
 */
export const calculatePerformanceScore = (slaCompliance, fcrRate, reopenRate) => {
    // Weighted calculation: 40% SLA, 40% FCR, 20% Reopen rate
    const slaScore = Math.max(0, Math.min(100, slaCompliance));
    const fcrScore = Math.max(0, Math.min(100, fcrRate));
    const reopenScore = Math.max(0, 100 - (reopenRate * 2)); // Lower reopens = higher score
    return (slaScore * 0.4 + fcrScore * 0.4 + reopenScore * 0.2);
};
/**
 * Determines optimization areas based on metrics
 */
export const identifyOptimizationAreas = (slaCompliance, fcrRate, reopenRate, avgResolutionTime) => {
    const areas = [];
    if (slaCompliance < 85) {
        areas.push('Improve SLA compliance - Consider priority-based task dispatch');
    }
    if (fcrRate < 75) {
        areas.push('Enhance FCR rate - Invest in knowledge base and training');
    }
    if (reopenRate > 10) {
        areas.push('Reduce ticket reopens - Review quality assurance processes');
    }
    if (avgResolutionTime > 6) {
        areas.push('Reduce resolution time - Identify bottlenecks and automate');
    }
    return areas.length > 0 ? areas : ['Team is performing at expected levels'];
};
/**
 * Calculates ideal task allocation based on team performance
 */
export const calculateIdealTaskAllocation = (teamMembers, totalNewTickets, performanceScores // userId -> score
) => {
    // Allocate more tickets to higher performing team members
    const allocation = {};
    const totalScore = Object.values(performanceScores).reduce((a, b) => a + b, 0);
    Object.entries(performanceScores).forEach(([userId, score]) => {
        const proportion = score / totalScore;
        allocation[parseInt(userId)] = Math.round(totalNewTickets * proportion);
    });
    return allocation;
};
