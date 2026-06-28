import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { TrendingUp, Clock3, RefreshCw, Award, AlertCircle } from 'lucide-react';
import { BarChart, Bar, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  calculateKPIs, 
  getAssignmentGroupPerformance, 
  getOptimizationNeeds,
  getWeeklyTicketSeries,
  aggregateWeeklySeriesToMonthly,
} from '../../utils/analytics';
import { weeklyCounts, getAssignmentGroupById, assignmentGroups, tickets as seedDataTickets } from '../../data/seedData';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';

export default function HRDashboard() {
  const MONTHLY_AGENT_CAPACITY_MIN = 190;
  const MONTHLY_AGENT_CAPACITY_MAX = 220;
  const MONTHLY_AGENT_CAPACITY_TARGET = (MONTHLY_AGENT_CAPACITY_MIN + MONTHLY_AGENT_CAPACITY_MAX) / 2;

  const getMonthlyTicketRateForGroup = (tickets: any[]): number => {
    if (!tickets || tickets.length === 0) return 0;

    const createdDates = tickets
      .map((ticket: any) => new Date(ticket.created_date || ticket.created_at || ticket.opened_at || ticket.updated_at || 0))
      .filter((date: Date) => !isNaN(date.getTime()))
      .sort((a: Date, b: Date) => a.getTime() - b.getTime());

    if (createdDates.length === 0) return 0;

    // Avoid unrealistic monthly extrapolation from very short observation windows.
    const first = createdDates[0].getTime();
    const last = createdDates[createdDates.length - 1].getTime();
    const durationDays = Math.max(14, (last - first) / (1000 * 60 * 60 * 24));
    const ticketsPerDay = tickets.length / durationDays;

    return ticketsPerDay * 30;
  };

  const DECISION_TREE_POLICY = {
    hireGrowthRateMin: 15,
    hireLoadRatioMin: 1.18,
    hireCapacityGapMin: 2,
    hireSlaMax: 88,
    hireFcrMax: 72,
    hireAvgResolutionMin: 1.8,
  };

  /**
   * Calculate average daily rate from historical tickets
   * Used to properly scale forecast constraints
   */
  const calculateAvgDailyRate = (tickets: any[]): number => {
    if (!tickets || tickets.length === 0) return 0;
    
    const createdDates = tickets
      .map((t: any) => new Date(t.created_date || t.created_at || t.opened_at || t.updated_at || 0))
      .filter((d: Date) => !isNaN(d.getTime()))
      .sort((a: Date, b: Date) => a.getTime() - b.getTime());
    
    if (createdDates.length === 0) return 0;
    
    const first = createdDates[0].getTime();
    const last = createdDates[createdDates.length - 1].getTime();
    const durationDays = Math.max(1, (last - first) / (1000 * 60 * 60 * 24));
    
    return tickets.length / durationDays;
  };

  /**
   * Smooth and process forecast to ensure realistic, continuous data
   * - Uses DAILY rate for proper scaling
   * - Smooth gradual changes
   * - Limits peak to 20-30% above actual daily average
   * - Removes sudden spikes and drops
   */
  const smoothForecast = (forecastDaily: number[], avgDailyRate: number): number[] => {
    if (!forecastDaily || forecastDaily.length === 0) return [];
    if (avgDailyRate <= 0) return forecastDaily; // Can't smooth without baseline
    
    const smoothed = [...forecastDaily];
    
    // Calculate max/min allowed values (20-30% above/below actual daily rate)
    // This prevents forecast from being 5-10x higher than actual
    const maxAllowed = avgDailyRate * 1.3; // Only 30% above actual
    const minAllowed = avgDailyRate * 0.75; // Can dip to 75% of actual
    
    // Clamp values to realistic range
    for (let i = 0; i < smoothed.length; i++) {
      smoothed[i] = Math.max(minAllowed, Math.min(maxAllowed, smoothed[i]));
    }
    
    // Apply exponential smoothing to eliminate sudden spikes
    const alpha = 0.25; // Conservative smoothing (more weight on historical)
    const result = [avgDailyRate]; // Start from average daily rate
    
    for (let i = 0; i < smoothed.length; i++) {
      const prevSmoothed = i === 0 ? avgDailyRate : result[result.length - 1];
      const smoothedValue = alpha * smoothed[i] + (1 - alpha) * prevSmoothed;
      result.push(smoothedValue);
    }
    
    return result.slice(1); // Remove the initial value, keep only the forecast
  };

  const { isAuthReady, users } = useAuth();
  const { data: uploadedData } = useData();
  const [backendTickets, setBackendTickets] = useState<any[]>([]);
  const [backendTicketsLoaded, setBackendTicketsLoaded] = useState(false);
  const [staffCountByGroup, setStaffCountByGroup] = useState<Record<number, number>>({});
  const [mlWorkloadForecast, setMlWorkloadForecast] = useState<{
    forecast: number[];
    model: string | null;
    dataSource: string | null;
    confidence: number | null;
    loading: boolean;
    error: string | null;
  }>({
    forecast: [],
    model: null,
    dataSource: null,
    confidence: null,
    loading: false,
    error: null,
  });
  const [mlStrategicRecommendations, setMlStrategicRecommendations] = useState<any[] | null>(null);
  const [mlStrategicModelName, setMlStrategicModelName] = useState<string | null>(null);
  const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    if (!isAuthReady) return;

    const token = localStorage.getItem('workwise_token');
    if (!token) {
      setBackendTickets([]);
      setBackendTicketsLoaded(true);
      return;
    }

    setBackendTicketsLoaded(false);
    fetch(`${apiBase.replace(/\/$/, '')}/api/kpis/dashboard/tickets?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load tickets');
        return response.json();
      })
      .then((tickets) => {
        setBackendTickets(Array.isArray(tickets) ? tickets : []);
      })
      .catch((error) => {
        console.warn('Failed to load backend tickets for HR dashboard', error);
        setBackendTickets([]);
      })
      .finally(() => {
        setBackendTicketsLoaded(true);
      });
  }, [apiBase, isAuthReady]);

  useEffect(() => {
    if (!isAuthReady) return;

    const token = localStorage.getItem('workwise_token');
    if (!token) {
      setStaffCountByGroup({});
      return;
    }

    fetch(`${apiBase.replace(/\/$/, '')}/api/kpis/staffing/group-counts?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load staffing group counts');
        return response.json();
      })
      .then((rows) => {
        const nextMap: Record<number, number> = {};
        (Array.isArray(rows) ? rows : []).forEach((row: any) => {
          const groupId = Number(row.assignment_group_id);
          const count = Number(row.user_count);
          if (Number.isFinite(groupId) && groupId > 0) {
            nextMap[groupId] = Number.isFinite(count) ? count : 0;
          }
        });
        setStaffCountByGroup(nextMap);
      })
      .catch((error) => {
        console.warn('Failed to load DB staffing group counts for HR dashboard', error);
        setStaffCountByGroup({});
      });
  }, [apiBase, isAuthReady]);

  const currentTickets = useMemo(() => {
    if (backendTicketsLoaded) return backendTickets;
    if (uploadedData && uploadedData.length > 0) return uploadedData;
    return [];
  }, [backendTickets, backendTicketsLoaded, uploadedData]);
  const trendTickets = currentTickets;
  const hasData = currentTickets.length > 0;

  const latestCreatedDate = useMemo(() => {
    const parsedDates = trendTickets
      .map((ticket: any) => new Date(
        ticket.created_date ??
        ticket.createdDate ??
        ticket.created_at ??
        ticket.createdAt ??
        ticket.opened_at ??
        ticket.openedAt ??
        ticket.updated_at ??
        ticket.updatedAt ??
        ''
      ))
      .filter((date: Date) => !Number.isNaN(date.getTime()));
    if (parsedDates.length === 0) return null;
    return new Date(Math.max(...parsedDates.map((date: Date) => date.getTime())));
  }, [trendTickets]);

  useEffect(() => {
    let isMounted = true;

    const loadMlForecast = async () => {
      setMlWorkloadForecast((current) => ({ ...current, loading: true, error: null }));
      try {
        const token = localStorage.getItem('workwise_token');
        if (!token) {
          throw new Error('ML forecast request skipped: missing auth token');
        }

        const endpoint = `${apiBase.replace(/\/$/, '')}/api/ml/forecast/tickets`;
        const retryableStatuses = new Set([429, 502, 503, 504]);
        const maxRetries = 2;
        let payload: any = null;
        let lastError: unknown = null;

        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
          try {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ days_ahead: 180 }),
            });

            if (!response.ok) {
              const shouldRetry = retryableStatuses.has(response.status) && attempt < maxRetries;
              if (!shouldRetry) {
                throw new Error(`ML forecast request failed with status ${response.status}`);
              }
              await new Promise((resolve) => setTimeout(resolve, 250 + attempt * 500));
              continue;
            }

            payload = await response.json();
            lastError = null;
            break;
          } catch (error) {
            lastError = error;
            const isFinalAttempt = attempt >= maxRetries;
            if (isFinalAttempt) {
              throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 250 + attempt * 500));
          }
        }

        if (!payload && lastError) {
          throw lastError;
        }

        if (!isMounted) return;

        setMlWorkloadForecast({
          forecast: Array.isArray(payload?.forecast) ? payload.forecast.map((value: any) => Number(value) || 0) : [],
          model: payload?.model ? String(payload.model) : null,
          dataSource: payload?.data_source ? String(payload.data_source) : null,
          confidence: payload?.confidence !== undefined ? Number(payload.confidence) : null,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (!isMounted) return;
        setMlWorkloadForecast({
          forecast: [],
          model: null,
          dataSource: null,
          confidence: null,
          loading: false,
          error: String(error),
        });
      }
    };

    loadMlForecast();
    return () => {
      isMounted = false;
    };
  }, [apiBase]);

  const kpis = calculateKPIs(currentTickets);
  const groupPerformance = getAssignmentGroupPerformance(currentTickets);
  const optimizationNeeds = getOptimizationNeeds(currentTickets);

  const actualWeeklySeries = useMemo(() => {
    if (trendTickets.length > 0) {
      return getWeeklyTicketSeries(trendTickets, {
        weeks: 24,
        futureWeeks: 0,
      }).map((point) => ({
        ...point,
        actualTickets: point.ticketCount,
      }));
    }

    return weeklyCounts
      .slice(-24)
      .map((w) => {
        const weekDate = new Date(w.week_start);
        const weekStart = Number.isNaN(weekDate.getTime())
          ? String(w.week_start)
          : `${weekDate.getFullYear()}-${String(weekDate.getMonth() + 1).padStart(2, '0')}-${String(weekDate.getDate()).padStart(2, '0')}`;
        return {
          weekStart,
          weekLabel: new Date(w.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          ticketCount: Number(w.ticket_count || 0),
          projected: false,
          predictedTickets: undefined,
          actualTickets: Number(w.ticket_count || 0),
        };
      });
  }, [trendTickets]);

  const workloadTrendSeries = useMemo(() => {
    const canUseMlForecast = trendTickets.length > 0 && mlWorkloadForecast.forecast.length > 0;
    if (!canUseMlForecast) {
      return actualWeeklySeries.map((point) => ({
        ...point,
        forecastTickets: null as number | null,
      }));
    }

    // Calculate average DAILY rate from historical data for proper scaling
    const avgDailyRate = calculateAvgDailyRate(trendTickets);
    
    // Smooth the forecast using daily rate (not weekly value!)
    // This prevents forecast from being 6x higher than actual
    const smoothedForecast = smoothForecast(mlWorkloadForecast.forecast, avgDailyRate);

    const futureWeeks = Math.max(12, Math.ceil(smoothedForecast.length / 7));
    const forecastSeries = getWeeklyTicketSeries(trendTickets, {
      weeks: 24,
      futureWeeks,
      forecastDaily: smoothedForecast,
      predictionStartDate: latestCreatedDate ?? undefined,
    });

    const actualByWeek = new Map(actualWeeklySeries.map((point) => [point.weekStart, point.ticketCount]));
    const latestActualWeekStart = actualWeeklySeries.length > 0
      ? actualWeeklySeries[actualWeeklySeries.length - 1].weekStart
      : null;

    return forecastSeries.map((point) => ({
      ...point,
      actualTickets: actualByWeek.has(point.weekStart) ? actualByWeek.get(point.weekStart)! : null,
      forecastTickets: latestActualWeekStart && point.weekStart === latestActualWeekStart
        ? (actualByWeek.get(point.weekStart) ?? null)
        : point.projected
          ? (point.predictedTickets ?? null)
          : null,
    }));
  }, [trendTickets, mlWorkloadForecast.forecast, latestCreatedDate, actualWeeklySeries, smoothForecast, calculateAvgDailyRate]);

  const monthlyWorkloadTrend = useMemo(
    () => aggregateWeeklySeriesToMonthly(workloadTrendSeries),
    [workloadTrendSeries]
  );

  // Get top and bottom performing groups
  const performanceScores = groupPerformance.map(g => ({
    ...g,
    teamName: getAssignmentGroupById(g.groupId)?.group_name || `Group ${g.groupId}`,
    overallScore: (0.6 * g.slaCompliance + 0.4 * g.fcrRate)
  }));

  const getCurrentStaffCount = (groupId: number, groupTickets: any[]) => {
    const dbUsersTableCount = Number(staffCountByGroup[groupId]);
    if (Number.isFinite(dbUsersTableCount) && dbUsersTableCount > 0) {
      return dbUsersTableCount;
    }

    const authContextUserCount = users.filter((user) => user.assignment_group_id === groupId).length;
    if (authContextUserCount > 0) {
      return authContextUserCount;
    }

    const assignedAgentIds = new Set(groupTickets
      .map((ticket: any) => Number(ticket.assigned_to_id))
      .filter((value: number) => Number.isFinite(value) && value > 0));
    return Math.max(assignedAgentIds.size, 1);
  };

  const staffingSummary = performanceScores.map(group => {
    const groupTickets = currentTickets.filter((ticket: any) => ticket.assignment_group_id === group.groupId);
    const currentStaff = getCurrentStaffCount(group.groupId, groupTickets);

    const groupMonthlyTicketRate = getMonthlyTicketRateForGroup(groupTickets);
    const currentLoadPerAgent = groupMonthlyTicketRate / Math.max(currentStaff, 1);
    const loadRatio = currentLoadPerAgent / MONTHLY_AGENT_CAPACITY_TARGET;
    const qualityPressure =
      group.slaCompliance < DECISION_TREE_POLICY.hireSlaMax ||
      group.fcrRate < DECISION_TREE_POLICY.hireFcrMax ||
      group.avgResolutionTime > DECISION_TREE_POLICY.hireAvgResolutionMin;
    const projectedMonthlyLoad = groupMonthlyTicketRate;
    const minimumRequiredStaff = Math.ceil(projectedMonthlyLoad / MONTHLY_AGENT_CAPACITY_TARGET);
    const projectedCapacityGap = Math.max(minimumRequiredStaff - currentStaff, 0);
    const shouldRecommendHire =
      loadRatio >= DECISION_TREE_POLICY.hireLoadRatioMin &&
      projectedCapacityGap >= DECISION_TREE_POLICY.hireCapacityGapMin &&
      qualityPressure;
    const recommendedStaff = shouldRecommendHire
      ? Math.max(currentStaff, minimumRequiredStaff)
      : currentStaff;
    const staffingGap = Math.max(recommendedStaff - currentStaff, 0);

    return {
      ...group,
      currentStaff,
      recommendedStaff,
      staffingGap,
      priority: staffingGap >= 3 ? 'High' : staffingGap >= 1 ? 'Medium' : 'Low'
    };
  });

  const topPerformers = [...performanceScores]
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, 5);

  const underperformers = [...performanceScores]
    .filter(g => g.overallScore < 75)
    .sort((a, b) => a.overallScore - b.overallScore);

  const recommendationData = useMemo(() => {
    const now = new Date();
    const recentWindowMs = 21 * 24 * 60 * 60 * 1000;
    const previousWindowMs = 42 * 24 * 60 * 60 * 1000;
    const parseTicketDate = (ticket: any) => new Date(ticket.created_date || ticket.created_at || ticket.opened_at || ticket.updated_at || 0);

    const recentTickets = currentTickets.filter((ticket: any) => {
      const date = parseTicketDate(ticket);
      return !isNaN(date.getTime()) && date.getTime() >= now.getTime() - recentWindowMs;
    });
    const previousTickets = currentTickets.filter((ticket: any) => {
      const date = parseTicketDate(ticket);
      return !isNaN(date.getTime()) &&
        date.getTime() >= now.getTime() - previousWindowMs &&
        date.getTime() < now.getTime() - recentWindowMs;
    });

    const recentCount = recentTickets.length;
    const previousCount = previousTickets.length;
    const growthRate = previousCount > 0 ? ((recentCount - previousCount) / previousCount) * 100 : 0;
    const isShortTermSpike = recentCount >= 8 && growthRate <= 10 && kpis.slaCompliance >= 88 && kpis.fcrRate >= 75;
    const isSustainedGrowth = growthRate > 10 && recentCount >= 10;

    const groupSummary = performanceScores.map((group) => {
      const groupTickets = currentTickets.filter((ticket: any) => ticket.assignment_group_id === group.groupId);
      const groupRecentCount = groupTickets.filter((ticket: any) => {
        const date = parseTicketDate(ticket);
        return !isNaN(date.getTime()) && date.getTime() >= now.getTime() - recentWindowMs;
      }).length;
      const groupPreviousCount = groupTickets.filter((ticket: any) => {
        const date = parseTicketDate(ticket);
        return !isNaN(date.getTime()) &&
          date.getTime() >= now.getTime() - previousWindowMs &&
          date.getTime() < now.getTime() - recentWindowMs;
      }).length;
      const groupGrowthRate = groupPreviousCount > 0
        ? ((groupRecentCount - groupPreviousCount) / groupPreviousCount) * 100
        : 0;
      const currentStaff = getCurrentStaffCount(group.groupId, groupTickets);
      const targetLoadPerAgent = MONTHLY_AGENT_CAPACITY_TARGET;
      const groupMonthlyTicketRate = getMonthlyTicketRateForGroup(groupTickets);
      const currentLoadPerAgent = groupMonthlyTicketRate / Math.max(currentStaff, 1);
      const projectedLoadPerAgent = currentLoadPerAgent * (1 + Math.max(groupGrowthRate, 0) / 100);
      const minimumRequiredStaff = Math.ceil(Math.max(groupMonthlyTicketRate / targetLoadPerAgent, projectedLoadPerAgent / targetLoadPerAgent));
      const projectedCapacityGap = Math.max(minimumRequiredStaff - currentStaff, 0);
      const hasHireQualityPressure =
        group.slaCompliance < DECISION_TREE_POLICY.hireSlaMax ||
        group.fcrRate < DECISION_TREE_POLICY.hireFcrMax ||
        group.avgResolutionTime > DECISION_TREE_POLICY.hireAvgResolutionMin;
      const shouldRecommendHire =
        groupGrowthRate >= DECISION_TREE_POLICY.hireGrowthRateMin &&
        (currentLoadPerAgent / targetLoadPerAgent) >= DECISION_TREE_POLICY.hireLoadRatioMin &&
        projectedCapacityGap >= DECISION_TREE_POLICY.hireCapacityGapMin &&
        hasHireQualityPressure;
      const recommendedStaff = shouldRecommendHire
        ? Math.max(currentStaff, minimumRequiredStaff)
        : currentStaff;
      const capacityGap = Math.max(recommendedStaff - currentStaff, 0);
      const loadRatio = currentLoadPerAgent / targetLoadPerAgent;
      const fairnessScore = Math.max(0, Math.min(100, Math.round(100 - Math.abs(loadRatio - 1) * 40)));
      const teamName = getAssignmentGroupById(group.groupId)?.group_name || `Group ${group.groupId}`;

      const decision = (() => {
        const hasKpiPressure = group.slaCompliance < 90 || group.fcrRate < 75 || group.avgResolutionTime > 1.6;
        if (capacityGap > 0 && hasKpiPressure && (isSustainedGrowth || loadRatio > 1.1)) {
          return 'Hire';
        }
        if (loadRatio > 1.05 && (group.slaCompliance >= 90 || group.fcrRate >= 75)) {
          return 'Temporary staffing / reassign';
        }
        if (group.slaCompliance < 88 || group.fcrRate < 72) {
          return 'Training';
        }
        return 'Retain & monitor';
      })();

      const predictedImpact = (() => {
        switch (decision) {
          case 'Hire':
            return {
              followed: { sla: '+2.5 pts', fcr: '+1.5 pts', resolution: '-0.4h' },
              notFollowed: { sla: '-1.2 pts', fcr: '-1.0 pts', resolution: '+0.3h' },
            };
          case 'Temporary staffing / reassign':
            return {
              followed: { sla: '+1.8 pts', fcr: '+1.0 pts', resolution: '-0.3h' },
              notFollowed: { sla: '-0.8 pts', fcr: '-0.7 pts', resolution: '+0.2h' },
            };
          case 'Training':
            return {
              followed: { sla: '+1.5 pts', fcr: '+3.0 pts', resolution: '-0.4h' },
              notFollowed: { sla: '-0.6 pts', fcr: '-1.8 pts', resolution: '+0.2h' },
            };
          default:
            return {
              followed: { sla: '+0.5 pts', fcr: '+0.4 pts', resolution: '-0.1h' },
              notFollowed: { sla: '-0.3 pts', fcr: '-0.2 pts', resolution: '+0.1h' },
            };
        }
      })();

      return {
        groupId: group.groupId,
        teamName,
        currentLoad: groupMonthlyTicketRate,
        recommendedLoad: Math.max(groupMonthlyTicketRate, recommendedStaff * targetLoadPerAgent),
        capacityGap,
        fairnessScore,
        loadRatio,
        groupRecentCount,
        groupPreviousCount,
        groupGrowthRate,
        slaCompliance: group.slaCompliance,
        fcrRate: group.fcrRate,
        avgResolutionTime: group.avgResolutionTime,
        decision,
        predictedImpact,
        rationale: (() => {
          if (decision === 'Hire') {
            return `Sustained load above target and KPI pressure indicate a permanent staffing fit.`;
          }
          if (decision === 'Temporary staffing / reassign') {
            return `Workload is elevated, but KPI quality is still acceptable so a short-term response is better.`;
          }
          if (decision === 'Training') {
            return `Performance indicators are below target, so coaching and process improvements should lead first.`;
          }
          return `Current demand is stable and the team is performing within acceptable limits.`;
        })(),
      };
    });

    const recommendations = groupSummary
      .filter((entry) => entry.decision !== 'Retain & monitor' || groupSummary.length <= 3)
      .sort((a, b) => {
        const priorityValue = (decision: string) => decision === 'Hire' ? 3 : decision === 'Training' ? 2 : decision === 'Temporary staffing / reassign' ? 1 : 0;
        return priorityValue(b.decision) - priorityValue(a.decision);
      })
      .slice(0, 6)
      .map((entry) => ({
        category: entry.decision === 'Hire' ? 'Hiring' : entry.decision === 'Training' ? 'Training' : entry.decision === 'Temporary staffing / reassign' ? 'Temporary staffing' : 'Retention',
        teamName: entry.teamName,
        action: (() => {
          if (entry.decision === 'Hire') {
            return `Add ${entry.capacityGap || 1} agent${entry.capacityGap === 1 ? '' : 's'} to ${entry.teamName} to close the sustained capacity gap.`;
          }
          if (entry.decision === 'Temporary staffing / reassign') {
            return `Use temporary staffing or cross-team reassignment for ${entry.teamName} to handle the short-term demand spike.`;
          }
          if (entry.decision === 'Training') {
            return `Run coaching and process improvement for ${entry.teamName} to improve FCR and reduce resolution time.`;
          }
          return `Retain current staffing in ${entry.teamName} and monitor the weekly trend.`;
        })(),
        impact: `${entry.predictedImpact.followed.sla} SLA, ${entry.predictedImpact.followed.fcr} FCR, ${entry.predictedImpact.followed.resolution} resolution`,
        predictedIfFollowed: `If followed: SLA ${entry.predictedImpact.followed.sla}, FCR ${entry.predictedImpact.followed.fcr}, resolution ${entry.predictedImpact.followed.resolution}`,
        predictedIfNotFollowed: `If not followed: SLA ${entry.predictedImpact.notFollowed.sla}, FCR ${entry.predictedImpact.notFollowed.fcr}, resolution ${entry.predictedImpact.notFollowed.resolution}`,
        businessImpact: entry.decision === 'Hire'
          ? 'Reduces overload risk and helps protect SLA during sustained growth.'
          : entry.decision === 'Training'
            ? 'Improves first-contact resolution and lowers avoidable rework.'
            : entry.decision === 'Temporary staffing / reassign'
              ? 'Covers demand peaks without committing to permanent headcount.'
              : 'Maintains service stability while keeping hiring decisions evidence-based.',
        priority: entry.decision === 'Hire' ? 'High' : entry.decision === 'Training' ? 'High' : entry.decision === 'Temporary staffing / reassign' ? 'Medium' : 'Low',
        rationale: entry.rationale,
      }));

    return {
      groupSummary,
      recommendations,
      recentCount,
      previousCount,
      growthRate,
      isShortTermSpike,
      isSustainedGrowth,
    };
  }, [currentTickets, kpis, performanceScores, groupPerformance, staffCountByGroup, users]);

  const {
    groupSummary,
    recommendations,
    recentCount,
    previousCount,
    growthRate,
    isShortTermSpike,
    isSustainedGrowth,
  } = recommendationData;

  const overallPerformance = hasData ? (0.6 * kpis.slaCompliance + 0.4 * kpis.fcrRate) : 0;

  useEffect(() => {
    if (!isAuthReady || groupSummary.length === 0) {
      setMlStrategicRecommendations(null);
      setMlStrategicModelName(null);
      return;
    }

    const token = localStorage.getItem('workwise_token');
    if (!token) {
      setMlStrategicRecommendations(null);
      setMlStrategicModelName(null);
      return;
    }

    const groupsPayload = groupSummary.map((entry) => ({
      groupId: entry.groupId,
      teamName: entry.teamName,
      currentLoad: entry.currentLoad,
      recommendedLoad: entry.recommendedLoad,
      capacityGap: entry.capacityGap,
      fairnessScore: entry.fairnessScore,
      loadRatio: entry.loadRatio,
      groupRecentCount: entry.groupRecentCount,
      groupPreviousCount: entry.groupPreviousCount,
      groupGrowthRate: entry.groupGrowthRate,
      slaCompliance: entry.slaCompliance,
      fcrRate: entry.fcrRate,
      avgResolutionTime: entry.avgResolutionTime,
    }));

    let isMounted = true;
    fetch(`${apiBase.replace(/\/$/, '')}/api/ml/hr/strategic-actions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        groups: groupsPayload,
        context: {
          growth_rate: growthRate,
          recent_count: recentCount,
          previous_count: previousCount,
        },
      }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Strategic actions ML request failed: ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (!isMounted) return;
        const rows = Array.isArray(payload?.recommendations) ? payload.recommendations : [];
        setMlStrategicRecommendations(rows.length > 0 ? rows : null);
        setMlStrategicModelName(typeof payload?.model?.name === 'string' ? payload.model.name : null);
      })
      .catch((error) => {
        console.warn('Failed to load Decision Tree strategic actions; using fallback recommendations.', error);
        if (!isMounted) return;
        setMlStrategicRecommendations(null);
        setMlStrategicModelName(null);
      });

    return () => {
      isMounted = false;
    };
  }, [apiBase, growthRate, groupSummary, isAuthReady, previousCount, recentCount]);

  const strategicRecommendations = mlStrategicRecommendations && mlStrategicRecommendations.length > 0
    ? mlStrategicRecommendations
    : recommendations;

  const prioritizedStrategicRecommendations = useMemo(() => {
    const priorityRank = (priority: string) => {
      if (priority === 'High') return 3;
      if (priority === 'Medium') return 2;
      return 1;
    };

    return [...strategicRecommendations].sort((a: any, b: any) => {
      const byPriority = priorityRank(b?.priority || 'Low') - priorityRank(a?.priority || 'Low');
      if (byPriority !== 0) return byPriority;

      const byCapacityGap = Number(b?.computedFrom?.capacityGap ?? b?.capacityGap ?? 0) - Number(a?.computedFrom?.capacityGap ?? a?.capacityGap ?? 0);
      if (byCapacityGap !== 0) return byCapacityGap;

      return String(a?.teamName || '').localeCompare(String(b?.teamName || ''));
    });
  }, [strategicRecommendations]);

  const extractScenarioKpis = (text: string | undefined, fallbackResolutionSign: 'negative' | 'positive') => {
    const safeText = String(text || '');
    const slaMatch = safeText.match(/SLA\s*([+-]?\d+(?:\.\d+)?)\s*pts/i);
    const fcrMatch = safeText.match(/FCR\s*([+-]?\d+(?:\.\d+)?)\s*pts/i);
    const resolutionMatch = safeText.match(/resolution\s*([+-]?\d+(?:\.\d+)?)\s*h/i);

    const sla = slaMatch ? Number(slaMatch[1]) : 0;
    const fcr = fcrMatch ? Number(fcrMatch[1]) : 0;
    let resolution = resolutionMatch ? Number(resolutionMatch[1]) : 0;

    // Some legacy strings omit the sign for followed scenarios; preserve expected direction.
    if (resolution !== 0 && !String(resolutionMatch?.[1] || '').startsWith('-') && !String(resolutionMatch?.[1] || '').startsWith('+')) {
      resolution = fallbackResolutionSign === 'negative' ? -Math.abs(resolution) : Math.abs(resolution);
    }

    return {
      sla,
      fcr,
      resolution,
    };
  };

  const formatKpiPointDelta = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)} pts`;
  const formatKpiHourDelta = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}h`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">HR & Senior Management Dashboard</h1>
        <p className="text-gray-600 mt-1">Organizational performance, team health, and strategic insights</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            1. Executive KPIs
          </span>
          <h2 className="text-lg font-semibold text-slate-900">Key operating indicators for the organization</h2>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Overall Performance</CardTitle>
              <Award className="w-4 h-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{overallPerformance.toFixed(1)}%</div>
              <p className="text-xs text-gray-500 mt-1">Composite SLA + FCR score</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Team Needing Support</CardTitle>
              <AlertCircle className="w-4 h-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{underperformers.length}</div>
              <p className="text-xs text-gray-500 mt-1">Teams below the target score</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            2. Overview & Forecasting
          </span>
          <h2 className="text-lg font-semibold text-slate-900">Organizational workload and forecast visibility</h2>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Organizational Workload Trend</CardTitle>
              <p className="text-xs text-gray-500 mt-1">Monthly actual volume versus ML forecast for the wider organization</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={monthlyWorkloadTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value: any) => `${Number(value).toLocaleString()}`} />
                  <Legend />
                  <Area type="monotone" dataKey="actualTickets" fill="#4F46E5" fillOpacity={0.16} stroke="#4F46E5" strokeWidth={2} name="Actual volume" />
                  <Line type="monotone" dataKey="forecastTickets" stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" connectNulls={false} dot={false} name="ML forecast" />
                </ComposedChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-slate-500">
                {mlWorkloadForecast.error
                  ? 'ML forecast unavailable; showing historical monthly volume only.'
                  : `Trend uses the same forecast pipeline as Admin Weekly Ticket Volume${mlWorkloadForecast.model ? ` (${mlWorkloadForecast.model})` : ''}${mlWorkloadForecast.dataSource ? ` using ${mlWorkloadForecast.dataSource} data` : ''}${mlWorkloadForecast.confidence !== null ? ` at ${Math.round(mlWorkloadForecast.confidence * 100)}% confidence` : ''}.`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Performing Teams (Based on SLA–FCR Composite Score)</CardTitle>
              <p className="text-xs text-gray-500 mt-1">Score = (0.6 × SLA %) + (0.4 × FCR %)</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart 
                  data={topPerformers.map(g => {
                    const score = g.overallScore;
                    let status = 'Needs Improvement';
                    let barColor = '#EF4444';
                    if (score >= 80) {
                      status = 'Good';
                      barColor = '#10B981';
                    } else if (score >= 70) {
                      status = 'Average';
                      barColor = '#F59E0B';
                    }
                    return { 
                      name: g.teamName, 
                      score: Number(score.toFixed(1)),
                      sla: Number(g.slaCompliance.toFixed(1)),
                      fcr: Number(g.fcrRate.toFixed(1)),
                      status,
                      color: barColor
                    };
                  })} 
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" width={140} />
                  <Tooltip 
                    formatter={(value, name) => {
                      if (name === 'score') return `${Number(value).toFixed(1)}%`;
                      return `${Number(value).toFixed(1)}%`;
                    }}
                    contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '4px' }}
                    labelFormatter={(label) => `Team: ${label}`}
                    content={({ active, payload }) => {
                      if (active && payload && payload[0]) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 border border-gray-300 rounded shadow-lg text-xs">
                            <p className="font-semibold">{data.name}</p>
                            <p className="text-slate-600">SLA: {data.sla}%</p>
                            <p className="text-slate-600">FCR: {data.fcr}%</p>
                            <p className="font-semibold mt-1">Final Score: {data.score}%</p>
                            <p className={`text-xs font-medium mt-1 px-2 py-1 rounded w-fit ${
                              data.status === 'Good' ? 'bg-green-100 text-green-800' :
                              data.status === 'Average' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {data.status}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="score" fill="#3B82F6" name="Composite Score" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-3 gap-4 text-center text-xs">
                <div className="p-2 bg-green-50 rounded">
                  <p className="text-green-700 font-semibold">≥80%</p>
                  <p className="text-green-600">Good</p>
                </div>
                <div className="p-2 bg-yellow-50 rounded">
                  <p className="text-yellow-700 font-semibold">70–79%</p>
                  <p className="text-yellow-600">Average</p>
                </div>
                <div className="p-2 bg-red-50 rounded">
                  <p className="text-red-700 font-semibold">&lt;70%</p>
                  <p className="text-red-600">Needs Improvement</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Staffing Gap Planning */}
      <Card>
        <CardHeader>
          <CardTitle>Team Staffing Gap Planning</CardTitle>
          <p className="text-xs text-gray-500 mt-1">Quantified headcount targets versus current assigned staff by team</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={staffingSummary.map(group => ({
              name: group.teamName,
              currentStaff: group.currentStaff,
              recommendedStaff: group.recommendedStaff
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="currentStaff" fill="#8B5CF6" name="Current Staff" />
              <Bar dataKey="recommendedStaff" fill="#10B981" name="Recommended Staff" />
            </BarChart>
          </ResponsiveContainer>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Team</th>
                  <th className="text-left p-3 font-medium">Workload</th>
                  <th className="text-left p-3 font-medium">Current Staff</th>
                  <th className="text-left p-3 font-medium">Recommended Staff</th>
                  <th className="text-left p-3 font-medium">Gap</th>
                  <th className="text-left p-3 font-medium">Priority</th>
                </tr>
              </thead>
              <tbody>
                {staffingSummary
                  .sort((a, b) => b.staffingGap - a.staffingGap)
                  .map(group => (
                    <tr key={group.groupId} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{group.teamName}</td>
                      <td className="p-3">{group.totalTickets} tickets</td>
                      <td className="p-3">{group.currentStaff} agents</td>
                      <td className="p-3">{group.recommendedStaff} agents</td>
                      <td className="p-3 font-medium text-orange-700">{group.staffingGap > 0 ? `+${group.staffingGap}` : 'Balanced'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          group.priority === 'High' ? 'bg-red-100 text-red-800' :
                          group.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {group.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Team Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Complete Team Performance Summary</CardTitle>
          <p className="text-xs text-gray-500 mt-1">All teams ranked by overall performance score</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Team Name</th>
                  <th className="text-left p-3 font-medium">Workload</th>
                  <th className="text-left p-3 font-medium">SLA</th>
                  <th className="text-left p-3 font-medium">FCR</th>
                  <th className="text-left p-3 font-medium">Avg Resolution</th>
                  <th className="text-left p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {performanceScores
                  .sort((a, b) => b.overallScore - a.overallScore)
                  .map(group => {
                    const compositeScore = 0.6 * group.slaCompliance + 0.4 * group.fcrRate;
                    const status = compositeScore >= 80 ? 'Good' : 
                                   compositeScore >= 70 ? 'Average' : 'Needs Improvement';
                    const avgResTime = !isNaN(group.avgResolutionTime) && Number.isFinite(group.avgResolutionTime)
                      ? Number(group.avgResolutionTime).toFixed(1)
                      : 'No Data';
                    
                    return (
                      <tr key={group.groupId} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{group.teamName}</td>
                        <td className="p-3">{group.totalTickets} tickets</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            group.slaCompliance >= 90 ? 'bg-green-100 text-green-800' :
                            group.slaCompliance >= 80 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {group.slaCompliance.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            group.fcrRate >= 75 ? 'bg-green-100 text-green-800' :
                            group.fcrRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {group.fcrRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-3">{avgResTime}{avgResTime !== 'No Data' ? 'h' : ''}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            status === 'Good' ? 'bg-green-100 text-green-800' :
                            status === 'Average' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recommended Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Strategic Actions</CardTitle>
          <p className="text-xs text-gray-500 mt-1">
            Data-driven recommendations for organizational improvement
            {mlStrategicModelName ? ` (model: ${mlStrategicModelName})` : ''}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {prioritizedStrategicRecommendations.map((rec, index) => (
              <div key={index} className="border rounded-lg p-4 hover:border-indigo-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 mb-2">
                      Assignment Group: {rec.teamName || 'Unspecified Group'}
                    </p>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-medium text-gray-900">{rec.category}</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        rec.priority === 'High' ? 'bg-red-100 text-red-800' :
                        rec.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {rec.priority} Priority
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-1">{rec.action}</p>
                    <p className="text-xs text-gray-500 mb-2">{rec.impact}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {(() => {
                        const followedKpis = extractScenarioKpis(rec.predictedIfFollowed, 'negative');
                        const notFollowedKpis = extractScenarioKpis(rec.predictedIfNotFollowed, 'positive');

                        return (
                          <>
                            <div className="rounded-md bg-slate-50 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">If followed</p>
                              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                <div className="rounded bg-white px-2 py-1">
                                  <span className="text-gray-500">SLA:</span>{' '}
                                  <span className="font-medium text-gray-800">{formatKpiPointDelta(followedKpis.sla)}</span>
                                </div>
                                <div className="rounded bg-white px-2 py-1">
                                  <span className="text-gray-500">FCR:</span>{' '}
                                  <span className="font-medium text-gray-800">{formatKpiPointDelta(followedKpis.fcr)}</span>
                                </div>
                                <div className="rounded bg-white px-2 py-1">
                                  <span className="text-gray-500">Resolution:</span>{' '}
                                  <span className="font-medium text-gray-800">{formatKpiHourDelta(followedKpis.resolution)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="rounded-md bg-slate-50 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">If not followed</p>
                              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                <div className="rounded bg-white px-2 py-1">
                                  <span className="text-gray-500">SLA:</span>{' '}
                                  <span className="font-medium text-gray-800">{formatKpiPointDelta(notFollowedKpis.sla)}</span>
                                </div>
                                <div className="rounded bg-white px-2 py-1">
                                  <span className="text-gray-500">FCR:</span>{' '}
                                  <span className="font-medium text-gray-800">{formatKpiPointDelta(notFollowedKpis.fcr)}</span>
                                </div>
                                <div className="rounded bg-white px-2 py-1">
                                  <span className="text-gray-500">Resolution:</span>{' '}
                                  <span className="font-medium text-gray-800">{formatKpiHourDelta(notFollowedKpis.resolution)}</span>
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    {rec.computedFrom && (
                      <div className="mt-3 rounded-md border border-indigo-100 bg-indigo-50/40 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Computed From</p>
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                          <div className="rounded bg-white px-2 py-1">
                            <span className="text-gray-500">Capacity Gap:</span>{' '}
                            <span className="font-medium text-gray-800">{Number(rec.computedFrom.capacityGap ?? 0).toFixed(2)}</span>
                          </div>
                          <div className="rounded bg-white px-2 py-1">
                            <span className="text-gray-500">Load Ratio:</span>{' '}
                            <span className="font-medium text-gray-800">{Number(rec.computedFrom.loadRatio ?? 0).toFixed(2)}</span>
                          </div>
                          <div className="rounded bg-white px-2 py-1">
                            <span className="text-gray-500">SLA:</span>{' '}
                            <span className="font-medium text-gray-800">{Number(rec.computedFrom.slaCompliance ?? 0).toFixed(2)}%</span>
                          </div>
                          <div className="rounded bg-white px-2 py-1">
                            <span className="text-gray-500">FCR:</span>{' '}
                            <span className="font-medium text-gray-800">{Number(rec.computedFrom.fcrRate ?? 0).toFixed(2)}%</span>
                          </div>
                          <div className="rounded bg-white px-2 py-1">
                            <span className="text-gray-500">Resolution:</span>{' '}
                            <span className="font-medium text-gray-800">{Number(rec.computedFrom.avgResolutionTime ?? 0).toFixed(2)}h</span>
                          </div>
                          <div className="rounded bg-white px-2 py-1">
                            <span className="text-gray-500">Growth:</span>{' '}
                            <span className="font-medium text-gray-800">{Number(rec.computedFrom.groupGrowthRate ?? 0).toFixed(2)}%</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <p className="mt-3 text-sm text-gray-700"><span className="font-semibold">Business impact:</span> {rec.businessImpact}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
