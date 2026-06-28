import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Users, Activity, AlertTriangle, Target, Filter } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine } from 'recharts';
import { calculateKPIs, getAssignmentGroupPerformance, getNonFCRTickets, getNonFCRTicketsWithCategoryRisk, getNewTickets, getInProgressTickets, getClosedTickets, getEmployeePerformance, isActionableNonFCRTicket } from '../../utils/analytics';
import { predictNonFCRRisk, NonFCRRiskScore } from '../../utils/mlAlgorithms';
import NonFCRRiskPanel from '../../components/NonFCRRiskPanel';
import { 
  tickets as seedDataTickets, 
  weeklyCounts, 
  getAssignmentGroupById, 
  getUserById,
  assignmentGroups,
  Ticket,
} from '../../data/seedData';
import { useLookupData } from '../../hooks/useLookupData';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';

interface TeamMemberMetrics {
  user_id: number;
  employee_name: string;
  current_tickets: number;
  sla_compliance: number;
  fcr_rate: number;
  capacity: number;
  experience_level: number;
  assignment_group_id?: number;
}

interface EmployeeWorkloadPayload {
  employee_id: number;
  employee_name: string;
  current_workload: number;
}

const env = (import.meta as any).env as Record<string, string | undefined>;

// Mapping of assignment group -> ticket categories they handle
const GROUP_CATEGORY_MAPPING: Record<number, number[]> = {
  1: [2, 3], // Software Team: Software Installation, Hardware Failure
  2: [1, 6], // Network Team: Network Issues, VPN Access
  3: [4, 1], // Security Team: Account Access, Network Issues
  4: [3], // Hardware Team: Hardware Failure
  5: [7, 5, 8, 4], // Service Desk: Password Reset, Email Issues, Printer Issues, Account Access
};

export default function ManagerDashboard() {
  const { user } = useAuth();
  const { data: uploadedData } = useData();
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'new' | 'closed'>('all');
  const [backendTickets, setBackendTickets] = useState<any[]>([]);
  const [backendTicketSummary, setBackendTicketSummary] = useState<any | null>(null);
  const [backendTicketsLoaded, setBackendTicketsLoaded] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);
  const apiBase = env.VITE_API_BASE_URL || env.VITE_API_URL || 'http://localhost:5000';

  const normalizeTicket = (ticket: any) => {
    if (!ticket || typeof ticket !== 'object') return ticket;
    return {
      ...ticket,
      assignment_group_id: ticket.assignment_group_id != null ? Number(ticket.assignment_group_id) : undefined,
      assigned_to_id: ticket.assigned_to_id != null ? Number(ticket.assigned_to_id) : undefined,
      category_id: ticket.category_id != null ? Number(ticket.category_id) : undefined,
      status_id: ticket.status_id != null ? Number(ticket.status_id) : undefined,
      priority_id: ticket.priority_id != null ? Number(ticket.priority_id) : undefined,
      reopen_count: ticket.reopen_count != null ? Number(ticket.reopen_count) : undefined,
      reassignment_count: ticket.reassignment_count != null ? Number(ticket.reassignment_count) : undefined,
      made_sla: ticket.made_sla === true || ticket.made_sla === 'true',
      fcr: ticket.fcr === true || ticket.fcr === 'true' ? true : ticket.fcr === false || ticket.fcr === 'false' ? false : undefined,
    };
  };

  const normalizedBackendTickets = useMemo(() => {
    if (!Array.isArray(backendTickets)) return [];
    return backendTickets.map(normalizeTicket);
  }, [backendTickets]);

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(user?.assignment_group_id ?? null);
  const selectedGroup = selectedGroupId !== null ? getAssignmentGroupById(selectedGroupId) : null;

  useEffect(() => {
    if (!user) return;

    if (selectedGroupId === null) {
      if (user.role === 'manager' && user.assignment_group_id) {
        setSelectedGroupId(user.assignment_group_id);
        return;
      }
      if (user.role === 'admin') {
        setSelectedGroupId(1);
        return;
      }
    }

    const token = localStorage.getItem('workwise_token');
    if (!token) {
      setBackendTickets([]);
      setBackendTicketsLoaded(true);
      return;
    }

    setLoadingTickets(true);
    setBackendTicketsLoaded(false);
    fetch(
      `${apiBase.replace(/\/$/, '')}/api/kpis/dashboard/tickets?assignment_group_id=${encodeURIComponent(
        String(selectedGroupId)
      )}&includeSummary=true&t=${Date.now()}`,
      {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    )
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load tickets');
        return response.json();
      })
      .then((responseData) => {
        if (responseData && typeof responseData === 'object' && Array.isArray(responseData.tickets)) {
          setBackendTickets(responseData.tickets);
          setBackendTicketSummary(responseData.summary || null);
        } else {
          setBackendTickets(Array.isArray(responseData) ? responseData : []);
          setBackendTicketSummary(null);
        }
      })
      .catch((error) => {
        console.warn('Failed to load backend tickets for manager dashboard', error);
        setBackendTickets([]);
      })
      .finally(() => {
        setLoadingTickets(false);
        setBackendTicketsLoaded(true);
      });
  }, [apiBase, user, selectedGroupId]);

  useEffect(() => {
    // Load users from backend so we can map user -> assignment group (from DB).
    // Managers can only fetch users in their own assignment group.
    const token = localStorage.getItem('workwise_token');
    if (!token || !user) return;

    const url = user?.role === 'manager'
      ? `${apiBase.replace(/\/$/, '')}/api/users/group/${selectedGroupId}`
      : `${apiBase.replace(/\/$/, '')}/api/users`;

    fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    })
      .then((r) => r.ok ? r.json() : Promise.reject('Failed to load users'))
      .then((u) => setUsersList(Array.isArray(u) ? u : []))
      .catch((err) => {
        console.warn('Failed to load users for assignment group mapping', err);
        setUsersList([]);
      });
  }, [apiBase, user, selectedGroupId]);

  useEffect(() => {
    if (!user || user.role !== 'manager' || !user.assignment_group_id) return;
    if (user.assignment_group_id !== selectedGroupId) {
      setSelectedGroupId(user.assignment_group_id);
    }
  }, [user, selectedGroupId]);

  const { getCategoryName, getStatusName, getPriorityLabel } = useLookupData(apiBase);

  const safeUploadedData = Array.isArray(uploadedData) ? uploadedData : [];

  const currentTickets = useMemo(() => {
    if (backendTicketsLoaded) {
      return normalizedBackendTickets.length > 0 ? normalizedBackendTickets : safeUploadedData;
    }

    if (!loadingTickets && safeUploadedData.length > 0) {
      return safeUploadedData;
    }

    return [];
  }, [normalizedBackendTickets, backendTicketsLoaded, loadingTickets, safeUploadedData]);

  const hasData = currentTickets.length > 0 || backendTicketSummary !== null;

  const selectedGroupTickets = useMemo(
    () => currentTickets.filter(t => Number(t.assignment_group_id) === Number(selectedGroupId)),
    [currentTickets, selectedGroupId]
  );
  const selectedGroupNonFCRTickets = useMemo(
    () => getNonFCRTickets(selectedGroupTickets),
    [selectedGroupTickets]
  );
  const displayGroupId = selectedGroupId ?? 0;
  const displayGroup = selectedGroupId !== null ? getAssignmentGroupById(selectedGroupId) : null;
  const groupTickets = selectedGroupTickets;
  const groupNonFCRTickets = selectedGroupNonFCRTickets;
  const [riskScoreMap, setRiskScoreMap] = useState<Record<string, NonFCRRiskScore>>({});
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState<string | null>(null);
  const groupNonFCRTicketRecords = useMemo(() => groupTickets.filter(isActionableNonFCRTicket), [groupTickets]);
  const groupHighRiskNonFCRTicketRecords = useMemo(() => {
    const activeStatuses = new Set([1, 2, 7]);
    return groupNonFCRTicketRecords.filter(ticket =>
      activeStatuses.has(Number(ticket.status_id)) &&
      (riskScoreMap[ticket.ticket_id]?.riskScore ?? 0) > 50
    );
  }, [groupNonFCRTicketRecords, riskScoreMap]);

  const highRiskScoredTicketsWithAgent = useMemo(() => {
    return groupHighRiskNonFCRTicketRecords.filter((ticket) => {
      const score = riskScoreMap[ticket.ticket_id]?.riskScore;
      const agentId = Number(ticket.assigned_to_id);
      return score != null && score > 50 && Number.isFinite(agentId);
    });
  }, [groupHighRiskNonFCRTicketRecords, riskScoreMap]);

  const agentProblemRows = useMemo(() => {
    const agentMap: Record<number, { agentId: number; totalRisk: number; ticketCount: number }> = {};

    highRiskScoredTicketsWithAgent.forEach((ticket) => {
      const score = riskScoreMap[ticket.ticket_id]?.riskScore;
      if (score == null || score <= 50) return;

      const agentId = Number(ticket.assigned_to_id);
      if (!Number.isFinite(agentId)) return;

      if (!agentMap[agentId]) {
        agentMap[agentId] = { agentId, totalRisk: 0, ticketCount: 0 };
      }

      agentMap[agentId].totalRisk += score;
      agentMap[agentId].ticketCount += 1;
    });

    return Object.values(agentMap)
      .map((row) => ({ ...row, avgRisk: row.totalRisk / row.ticketCount }))
      .sort((a, b) => b.avgRisk - a.avgRisk)
      .slice(0, 5);
  }, [highRiskScoredTicketsWithAgent, riskScoreMap]);

  const categoryProblemRows = useMemo(() => {
    const categoryMap: Record<number, { categoryId: number; scores: number[]; fcrTickets: number; totalTickets: number; uniqueAgents: Set<number> }> = {};

    groupTickets.forEach((ticket) => {
      const categoryId = Number(ticket.category_id);
      if (!Number.isFinite(categoryId)) return;

      if (!categoryMap[categoryId]) {
        categoryMap[categoryId] = { categoryId, scores: [], fcrTickets: 0, totalTickets: 0, uniqueAgents: new Set<number>() };
      }

      const entry = categoryMap[categoryId];
      entry.totalTickets += 1;

      const isFCR = ticket.fcr === true || ticket.fcr === 'true' || Number(ticket.reopen_count || 0) === 0;
      if (isFCR) entry.fcrTickets += 1;
    });

    highRiskScoredTicketsWithAgent.forEach((ticket) => {
      const categoryId = Number(ticket.category_id);
      if (!Number.isFinite(categoryId) || !categoryMap[categoryId]) return;

      const score = riskScoreMap[ticket.ticket_id]?.riskScore;
      const agentId = Number(ticket.assigned_to_id);
      if (score == null || score <= 50 || !Number.isFinite(agentId)) return;

      categoryMap[categoryId].scores.push(score);
      categoryMap[categoryId].uniqueAgents.add(agentId);
    });

    return Object.values(categoryMap)
      .map((entry) => {
        const avgRisk = entry.scores.length > 0 ? entry.scores.reduce((sum, value) => sum + value, 0) / entry.scores.length : 0;
        const fcrRate = entry.totalTickets > 0 ? (entry.fcrTickets / entry.totalTickets) * 100 : 0;
        const uniqueAgents = entry.uniqueAgents.size;
        let problemTypeLabel = 'Category-related issue';
        if (uniqueAgents >= 2) {
          problemTypeLabel = 'Mixed issue';
        }

        let recommendation = 'Monitor';
        if (fcrRate < 40) {
          recommendation = 'Needs training + process review';
        } else if (fcrRate < 60) {
          recommendation = 'Needs coaching + documentation';
        }

        return {
          categoryId: entry.categoryId,
          categoryName: getCategoryName(entry.categoryId),
          avgRisk,
          fcrRate,
          problemTypeLabel,
          recommendation,
        };
      })
      .filter((row) => row.avgRisk > 0)
      .sort((a, b) => b.avgRisk - a.avgRisk)
      .slice(0, 5);
  }, [groupTickets, highRiskScoredTicketsWithAgent, riskScoreMap, getCategoryName]);

  const groupNonFCRCategoryRiskRows = useMemo(
    () => getNonFCRTicketsWithCategoryRisk(groupTickets),
    [groupTickets]
  );
  const [aggregatedNonFCRRows, setAggregatedNonFCRRows] = useState<any[] | null>(null);
  const [selectedRiskRow, setSelectedRiskRow] = useState<any | null>(null);
  const [riskDetailsOpen, setRiskDetailsOpen] = useState(false);
  const isFallbackGroup = false;

  // Build a deduplicated display list: one row per category+agent. Prefer backend aggregated rows when available,
  // otherwise build from group tickets (fallback). Each row includes ticketIds array for drilldown.
  const aggregatedDisplayRows = useMemo(() => {
    if (aggregatedNonFCRRows && Array.isArray(aggregatedNonFCRRows)) {
      return aggregatedNonFCRRows.map((r: any) => ({
        categoryId: r.categoryId,
        agentId: r.agentId,
        categoryFCRRate: r.categoryFCRRate,
        agentCategoryFCRRate: r.agentCategoryFCRRate,
        action: r.action,
        ticketIds: Array.isArray(r.ticketIds) ? r.ticketIds : [],
        totalTickets: r.totalTickets || (Array.isArray(r.ticketIds) ? r.ticketIds.length : 0),
      }));
    }

    // Fallback: aggregate groupTickets client-side into category+agent rows
    const map = new Map();
    // Build totals per category+agent using all tickets so FCR rates are accurate,
    // but only collect ticketIds for non-FCR (flagged) tickets to show in the drilldown.
    groupTickets.forEach((t) => {
      const cat = Number(t.category_id) || 0;
      const agent = t.assigned_to_id ? Number(t.assigned_to_id) : null;
      const key = `${cat}|${agent ?? 'null'}`;
      if (!map.has(key)) {
        map.set(key, { categoryId: cat, agentId: agent, ticketIds: [] as any[], total: 0, fcrCount: 0 });
      }
      const entry = map.get(key);
      // Count totals and fcrs over all tickets
      entry.total += 1;
      if (t.fcr === true || t.fcr === 'true') entry.fcrCount += 1;
      // If this ticket is non-FCR, include it in the flagged ticket list
      if (isActionableNonFCRTicket(t)) entry.ticketIds.push(t.ticket_id);
    });

    // Compute category-level FCR rates from all tickets in group
    const categoryTotals: Record<number, { total: number; fcr: number }> = {};
    groupTickets.forEach((t) => {
      const cat = Number(t.category_id) || 0;
      if (!categoryTotals[cat]) categoryTotals[cat] = { total: 0, fcr: 0 };
      categoryTotals[cat].total += 1;
      if (t.fcr === true || t.fcr === 'true') categoryTotals[cat].fcr += 1;
    });

    const rows: any[] = [];
    for (const [, v] of map) {
      const category = categoryTotals[v.categoryId] || { total: 0, fcr: 0 };
      const categoryFCRRate = category.total > 0 ? (category.fcr / category.total) * 100 : 0;
      const agentCategoryFCRRate = v.total > 0 ? (v.fcrCount / v.total) * 100 : 0;
      let action = 'No Risk: retain assignment';
      if (categoryFCRRate < 40 && agentCategoryFCRRate === 0) {
        action = 'Dual Alert: retrain agent and escalate systemic fixes';
      } else if (categoryFCRRate < 40) {
        action = 'Systemic Category Issue: everyone struggles, process fix needed';
      } else if (agentCategoryFCRRate < categoryFCRRate - 20) {
        action = 'Agent Skill Gap: training/coaching needed';
      }
      rows.push({
        categoryId: v.categoryId,
        agentId: v.agentId,
        categoryFCRRate,
        agentCategoryFCRRate,
        action,
        ticketIds: v.ticketIds,
        totalTickets: v.total,
      });
    }

    return rows;
  }, [aggregatedNonFCRRows, groupTickets]);

  const selectRiskRow = (row: any) => {
    // Build sample tickets list from available group tickets and aggregated ticket ids when present
    let sampleTickets: any[] = [];
    if (row.ticketIds && Array.isArray(row.ticketIds) && row.ticketIds.length > 0) {
      const idSet = new Set(row.ticketIds.map((id: any) => String(id)));
      sampleTickets = groupTickets.filter(t => idSet.has(String(t.ticket_id)) && isActionableNonFCRTicket(t) && Number(t.category_id) === Number(row.categoryId) && (row.agentId == null || Number(t.assigned_to_id) === Number(row.agentId)));
    }
    // Fallback: find any matching non-FCR ticket
    if (sampleTickets.length === 0) {
      const fallback = groupTickets.find((t) => isActionableNonFCRTicket(t) && Number(t.category_id) === Number(row.categoryId) && (row.agentId == null || Number(t.assigned_to_id) === Number(row.agentId)));
      if (fallback) sampleTickets = [fallback];
    }

    setSelectedRiskRow({ ...row, sampleTickets });
    setRiskDetailsOpen(true);
  };
  
  // Calculate KPIs for manager's group only
  const groupKPIs = {
    slaCompliance: backendTicketSummary?.total
      ? (Number(backendTicketSummary.sla_met || 0) / Number(backendTicketSummary.total)) * 100
      : groupTickets.length > 0
      ? (groupTickets.filter(t => t.made_sla).length / groupTickets.length) * 100
      : 0,
    fcrRate: backendTicketSummary?.total
      ? (Number(backendTicketSummary.fcr_count || 0) / Number(backendTicketSummary.total)) * 100
      : groupTickets.length > 0
      ? (groupTickets.filter(t => t.fcr === true || t.fcr === 'true').length / groupTickets.length) * 100
      : 0,
    totalTickets: backendTicketSummary?.total ?? groupTickets.length,
    activeTickets: groupTickets.filter(t => Number(t.status_id) !== 3 && Number(t.status_id) !== 4).length,
    resolvedTickets: backendTicketSummary?.resolved_count ?? groupTickets.filter(t => Number(t.status_id) === 3 || Number(t.status_id) === 4).length,
  };

  // Task allocation by status
  const newTasks = groupTickets.filter(t => t.status_id === 1).length;
  const openTasks = groupTickets.filter(t => t.status_id === 6).length;
  const assignedTasks = groupTickets.filter(t => t.assigned_to_id && t.status_id === 2).length;
  const pendingTasks = groupTickets.filter(t => t.status_id === 5).length;
  

  const [nfcrPage, setNfcrPage] = useState(0);
  const nfcrPageSize = 10;
  const nfcrTotalPages = Math.max(1, Math.ceil(groupHighRiskNonFCRTicketRecords.length / nfcrPageSize));

  useEffect(() => {
    if (nfcrPage >= nfcrTotalPages) setNfcrPage(0);
  }, [nfcrTotalPages]);

  const nfcrPageTickets = useMemo(() => {
    const start = nfcrPage * nfcrPageSize;
    return groupHighRiskNonFCRTicketRecords.slice(start, start + nfcrPageSize);
  }, [groupHighRiskNonFCRTicketRecords, nfcrPage]);
  const [recommendations, setRecommendations] = useState<Ticket[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [workloadAnalysis, setWorkloadAnalysis] = useState<any>(null);
  const [imbalanceAnalysis, setImbalanceAnalysis] = useState<any>(null);
  const [workloadBalance, setWorkloadBalance] = useState<any>(null);
  const [workloadMlError, setWorkloadMlError] = useState<string | null>(null);
  const [workloadBalanceLoading, setWorkloadBalanceLoading] = useState(false);
  const [imbalanceLoading, setImbalanceLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'recommendations'>('overview');
  const [mlInsights, setMlInsights] = useState({
    forecastMean: null as number | null,
    forecastUpper: null as number | null,
    forecastLower: null as number | null,
    forecastArray: [] as number[],
    forecastUpperArray: [] as number[],
    forecastLowerArray: [] as number[],
    anomalyCount: 0,
    anomalyPeak: null as number | null,
    loading: false,
    error: null as string | null,
  });

  // ML-driven visualizations: risk distribution and driver frequency
  const riskDistributionData = useMemo(() => {
    const buckets: Record<string, number> = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    Object.values(riskScoreMap).forEach((r) => {
      const score = r?.riskScore ?? 0;
      if (score >= 70) buckets.Critical += 1;
      else if (score >= 50) buckets.High += 1;
      else if (score >= 30) buckets.Medium += 1;
      else buckets.Low += 1;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [riskScoreMap]);

  const driverFrequencyData = useMemo(() => {
    const freq: Record<string, number> = {};
    Object.values(riskScoreMap).forEach((r) => {
      const factors = Array.isArray(r?.factors) ? r.factors : [];
      factors.forEach((f) => { freq[f] = (freq[f] || 0) + 1; });
    });
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));
  }, [riskScoreMap]);

  const taskAllocationData = [
    { name: 'New', value: newTasks, color: '#3B82F6' },
    { name: 'Open', value: openTasks, color: '#10B981' },
    { name: 'Assigned', value: assignedTasks, color: '#8B5CF6' },
    { name: 'Pending', value: pendingTasks, color: '#F59E0B' }
  ];

  const currentStaffCount = useMemo(() => {
    const assignedAgentIds = new Set(groupTickets
      .map(ticket => ticket.assigned_to_id)
      .filter((value): value is number => typeof value === 'number'));
    return assignedAgentIds.size > 0 ? assignedAgentIds.size : 1;
  }, [groupTickets]);

  const teamMemberMetrics = useMemo(() => {
    const agentMap: Record<number, {
      user_id: number;
      employee_name: string;
      current_tickets: number;
      sla_compliance: number;
      fcr_rate: number;
      capacity: number;
      experience_level: number;
      assignment_group_id?: number;
    }> = {};

    groupTickets.forEach(ticket => {
      const userId = ticket.assigned_to_id;
      if (typeof userId !== 'number') return;
      if (!agentMap[userId]) {
        const user = getUserById(userId);
        agentMap[userId] = {
          user_id: userId,
          employee_name: user ? `${user.first_name} ${user.last_name}` : `Agent ${userId}`,
          current_tickets: 0,
          sla_compliance: 0,
          fcr_rate: 0,
          capacity: 10,
          experience_level: 1,
          assignment_group_id: user?.assignment_group_id,
        };
      }

      const agent = agentMap[userId];
      agent.current_tickets += 1;
      if (ticket.made_sla) agent.sla_compliance += 1;
      if (ticket.fcr) agent.fcr_rate += 1;
    });

    return Object.values(agentMap).map((agent) => ({
      ...agent,
      sla_compliance: agent.current_tickets > 0 ? Number((agent.sla_compliance / agent.current_tickets * 100).toFixed(1)) : 0,
      fcr_rate: agent.current_tickets > 0 ? Number((agent.fcr_rate / agent.current_tickets * 100).toFixed(1)) : 0,
    }));
  }, [groupTickets]);

  const averageRiskScore = useMemo(() => {
    const values = groupNonFCRTickets
      .map(ticket => riskScoreMap[ticket.ticket_id]?.riskScore)
      .filter((value): value is number => typeof value === 'number');

    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [groupNonFCRTickets, riskScoreMap]);

  // Weekly workload for this group (from uploaded data)
  const weeklyGroupData = (() => {
    if (!hasData) return [] as { week: string; tickets: number }[];
    const map: Record<string, number> = {};
    currentTickets.forEach((t: any) => {
      if (t.assignment_group_id !== displayGroupId) return;
      const d = new Date(t.created_date);
      const wk = new Date(d);
      wk.setDate(wk.getDate() - wk.getDay());
      const key = wk.toISOString().split('T')[0];
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([week, count]) => ({ week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), tickets: count }));
  })();

  const forecastDemand = mlInsights.forecastMean ?? (groupTickets.length > 0 ? groupTickets.length : 0);
  const agentCapacityTarget = 10;
  const currentCapacity = currentStaffCount * agentCapacityTarget;
  const requiredStaff = Math.ceil(forecastDemand / agentCapacityTarget);
  const staffingGap = requiredStaff - currentStaffCount;
  const demandCapacityRatio = forecastDemand / Math.max(currentCapacity, 1);
  const workloadPerAgent = forecastDemand / Math.max(currentStaffCount, 1);
  const overloadDelta = Math.max(0, forecastDemand - currentCapacity);
  const capacityUtilization = (forecastDemand / Math.max(currentCapacity, 1)) * 100;
  const staffingDecision = demandCapacityRatio > 1.1 ? 'Hire' : demandCapacityRatio >= 0.9 ? 'Redistribute' : 'Maintain';
  const staffingReason = `${workloadPerAgent > agentCapacityTarget ? 'Workload overload is driving SLA risk.' : 'Workload remains within target capacity.'} ${averageRiskScore >= 70 ? 'High repeat-ticket risk is lowering FCR performance.' : 'FCR risk is moderate and monitorable.'} ${demandCapacityRatio > 1.1 ? 'Capacity mismatch warrants staffing action.' : 'Current capacity is broadly aligned with demand.'}`;

  // Determine if current group is imbalanced and should show redistribution recommendations
  const isGroupImbalanced = useMemo(() => {
    return demandCapacityRatio > 1.1 || (workloadPerAgent > agentCapacityTarget && currentStaffCount > 1);
  }, [demandCapacityRatio, workloadPerAgent, agentCapacityTarget, currentStaffCount]);

  // Find groups that can accept tickets from the current group's categories
  const acceptingGroupsForOffload = useMemo(() => {
    if (!isGroupImbalanced) return [];
    
    const currentGroupCategories = selectedGroupId !== null ? GROUP_CATEGORY_MAPPING[selectedGroupId] || [] : [];
    const potentialReceivers: number[] = [];
    
    Object.entries(GROUP_CATEGORY_MAPPING).forEach(([groupIdStr, categories]) => {
      const groupId = Number(groupIdStr);
      if (groupId === selectedGroupId) return; // Don't offload to self
      // Check if this group handles any of the current group's categories
      if (currentGroupCategories.some(cat => categories.includes(cat))) {
        potentialReceivers.push(groupId);
      }
    });
    
    return potentialReceivers;
  }, [isGroupImbalanced, selectedGroupId]);

  const fallbackWorkloadBalance = useMemo(() => {
    if (!teamMemberMetrics || teamMemberMetrics.length === 0) return null;
    if (!isGroupImbalanced) return null; // Only show recommendations if imbalanced

    const currentLoads = teamMemberMetrics.map((member) => Number(member.current_tickets ?? 0));
    const totalCurrentLoad = currentLoads.reduce((sum, load) => sum + load, 0);
    const forecastLoad = Math.round(mlInsights.forecastMean ?? groupTickets.length ?? 0);
    const totalWorkload = totalCurrentLoad + Math.max(0, forecastLoad);
    const agentCount = Math.max(1, teamMemberMetrics.length);
    const targetLoad = Math.round(totalWorkload / agentCount);
    const minLoad = Math.min(...currentLoads);
    const maxLoad = Math.max(...currentLoads);
    const meanLoad = totalCurrentLoad / agentCount;
    const imbalanceRatio = minLoad > 0 ? maxLoad / minLoad : 1;
    const fairnessScore = 1 - Math.min(imbalanceRatio / 1.5, 1);
    const stdDev = Math.sqrt(currentLoads.reduce((sum, load) => sum + Math.pow(load - meanLoad, 2), 0) / agentCount);

    // For overloaded members, suggest offloading to accepting groups
    const recommendations = teamMemberMetrics.map((member) => {
      const currentLoad = Number(member.current_tickets ?? 0);
      const adjustment = targetLoad - currentLoad;
      
      // If this member is overloaded and we have accepting groups, suggest them
      let suggestedGroupId = member.assignment_group_id ?? selectedGroupId;
      if (adjustment < -5 && acceptingGroupsForOffload.length > 0) {
        // Suggest the first accepting group
        suggestedGroupId = acceptingGroupsForOffload[0];
      }

      return {
        user_id: member.user_id,
        employee_name: member.employee_name,
        assignment_group_id: suggestedGroupId,
        current_load: currentLoad,
        recommended_load: targetLoad,
        adjustment,
        tickets_to_assign: Math.max(0, adjustment),
        tickets_to_release: Math.max(0, -adjustment),
        sla_compliance: Number(member.sla_compliance ?? 85),
        fcr_rate: Number(member.fcr_rate ?? 70),
        capacity: Number(member.capacity ?? 10),
      };
    });

    const currentAnalysis = {
      mean: Number(meanLoad.toFixed(1)),
      std_dev: Number(stdDev.toFixed(2)),
      coefficient_of_variation: Number((meanLoad > 0 ? stdDev / meanLoad : 0).toFixed(2)),
      imbalance_ratio: Number(imbalanceRatio.toFixed(2)),
      total_workload: totalWorkload,
      min_load: minLoad,
      max_load: maxLoad,
      fairness_score: Number(fairnessScore.toFixed(2)),
    };

    const optimizedAnalysis = {
      ...currentAnalysis,
      mean: targetLoad,
    };

    return {
      recommendations,
      is_balanced: imbalanceRatio <= 1.5,
      optimization_status: 'fallback',
      target_load: Number(targetLoad.toFixed(1)),
      current_analysis: currentAnalysis,
      optimized_analysis: optimizedAnalysis,
      predicted_improvements: {
        sla_compliance_gain_pct: 0,
        avg_resolution_time_reduction_pct: 0,
        fcr_rate_gain_pct: 0,
        summary: `This ${selectedGroup?.group_name || 'group'} is overloaded. Consider offloading qualifying tickets to other specialized teams.`,
      },
      total_reassignments: recommendations.reduce((sum, rec) => sum + Math.max(0, Number(rec.adjustment ?? 0)), 0),
      fairness_score: Number(fairnessScore.toFixed(2)),
      business_impact: { note: 'Group-specific fallback estimate' },
    };
  }, [teamMemberMetrics, mlInsights.forecastMean, groupTickets.length, isGroupImbalanced, selectedGroupId, selectedGroup, acceptingGroupsForOffload]);


  const effectiveWorkloadBalance = workloadBalance ?? fallbackWorkloadBalance;

  const predictedKpiImprovements = useMemo(() => {
    if (effectiveWorkloadBalance?.predicted_improvements) {
      return effectiveWorkloadBalance.predicted_improvements;
    }

    const currentFairness = effectiveWorkloadBalance?.current_analysis?.fairness_score ?? workloadAnalysis?.analysis?.fairness_score ?? 0;
    const optimizedFairness = effectiveWorkloadBalance?.optimized_analysis?.fairness_score ?? Math.min(1, currentFairness + 0.08);
    const currentCv = effectiveWorkloadBalance?.current_analysis?.coefficient_of_variation ?? workloadAnalysis?.analysis?.coefficient_of_variation ?? 0.2;
    const improvedCv = Math.max(0, currentCv - 0.05);

    const slaGain = Math.max(0, Math.min(10, (optimizedFairness - currentFairness) * 20 + (currentCv - improvedCv) * 10));
    const resolutionGain = Math.max(0, Math.min(15, (optimizedFairness - currentFairness) * 18 + (currentCv - improvedCv) * 12));
    const fcrGain = Math.max(0, Math.min(8, (optimizedFairness - currentFairness) * 9 + (currentCv - improvedCv) * 4));

    return {
      sla_compliance_gain_pct: Number(slaGain.toFixed(1)),
      avg_resolution_time_reduction_pct: Number(resolutionGain.toFixed(1)),
      fcr_rate_gain_pct: Number(fcrGain.toFixed(1)),
      summary: `Workload balancing may improve SLA compliance by about ${slaGain.toFixed(1)} points, reduce average resolution time by ${resolutionGain.toFixed(1)}%, and boost FCR by ${fcrGain.toFixed(1)} points.`
    };
  }, [effectiveWorkloadBalance, workloadAnalysis]);

  const isServiceDeskGroup = selectedGroup?.group_name === 'Service Desk';

  const workloadBalanceRecommendations = useMemo(() => {
    if (!effectiveWorkloadBalance) return [];
    if (!isGroupImbalanced || !isServiceDeskGroup) return [];
    return Array.isArray(effectiveWorkloadBalance.recommendations) ? effectiveWorkloadBalance.recommendations as any[] : [];
  }, [effectiveWorkloadBalance, effectiveWorkloadBalance?.recommendations, isGroupImbalanced, isServiceDeskGroup]);

  const workloadRecommendationSummary = useMemo(() => {
    if (!isGroupImbalanced || !isServiceDeskGroup || workloadBalanceRecommendations.length === 0) return [];
    return workloadBalanceRecommendations.map((rec) => {
      const currentLoad = Number(rec.current_load ?? 0);
      const adjustment = Number(rec.adjustment ?? 0);
      const redirectPct = currentLoad > 0 ? Math.round(Math.abs(adjustment) / currentLoad * 100) : 0;
      const flag = adjustment > 1 ? 'Overloaded' : adjustment < -1 ? 'Underloaded' : 'Balanced';
      const expectedSla = `+${predictedKpiImprovements.sla_compliance_gain_pct ?? 0}%`;
      const expectedFcr = `+${predictedKpiImprovements.fcr_rate_gain_pct ?? 0}%`;

      const targetGroupId = Number(rec.assignment_group_id ?? 0);
      let suggestedTeam = targetGroupId && targetGroupId !== selectedGroupId
        ? getAssignmentGroupById(targetGroupId)?.group_name
        : null;

      if (!suggestedTeam && flag === 'Overloaded' && acceptingGroupsForOffload.length > 0) {
        suggestedTeam = getAssignmentGroupById(acceptingGroupsForOffload[0])?.group_name ?? null;
      }

      if (!suggestedTeam) {
        suggestedTeam = selectedGroup?.group_name ?? 'Current Group';
      }

      return {
        user_id: rec.user_id,
        flag,
        redirectPct,
        suggestedTeam,
        expectedSla,
        expectedFcr,
      };
    });
  }, [workloadBalanceRecommendations, predictedKpiImprovements, acceptingGroupsForOffload, selectedGroupId, selectedGroup]);

  const staffingScenarioData = [0, 1, 2, 3].map((extraAgents) => {
    const scenarioStaff = currentStaffCount + extraAgents;
    const projectedLoadPerAgent = forecastDemand / Math.max(scenarioStaff, 1);
    const projectedSla = Math.max(60, Math.min(98, 96 - Math.max(0, projectedLoadPerAgent - agentCapacityTarget) * 2.5));
    const scenarioCapacityRatio = forecastDemand / Math.max(scenarioStaff * agentCapacityTarget, 1);
    return {
      scenario: extraAgents === 0 ? 'Current' : `+${extraAgents} agent${extraAgents === 1 ? '' : 's'}`,
      staff: scenarioStaff,
      projectedLoadPerAgent: Number(projectedLoadPerAgent.toFixed(1)),
      projectedSla: Number(projectedSla.toFixed(1)),
      capacityRatio: Number(scenarioCapacityRatio.toFixed(2)),
      action: scenarioCapacityRatio > 1.1 ? 'Hire' : scenarioCapacityRatio >= 0.9 ? 'Redistribute' : 'Maintain'
    };
  });

  const recommendedScenario = staffingScenarioData.reduce((best, scenario) => scenario.projectedSla > best.projectedSla ? scenario : best, staffingScenarioData[0]);

  const categoryLoadData = Object.entries(groupTickets.reduce<Record<string, number>>((acc, ticket) => {
    const label = getCategoryName(ticket.category_id);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {}))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([category, count]) => ({
      category,
      tickets: count,
      workloadPerAgent: Number((count / Math.max(currentStaffCount, 1)).toFixed(1))
    }));

  const weightedForecastData = useMemo(() => {
    if (weeklyGroupData.length === 0) return [];
    
    // Historical data from actual tickets
    const historicalData = weeklyGroupData.map((entry) => ({
      week: entry.week,
      actualTickets: entry.tickets,
      forecastTarget: null as number | null,
      capacityThreshold: currentStaffCount * agentCapacityTarget,
      isHistorical: true,
    }));

    // Forecast data from ML
    if (mlInsights.forecastArray.length === 0) return historicalData;

    const forecastData: any[] = [];
    const now = new Date();
    
    // Group forecast data by week for cleaner visualization
    let weekAccum = 0;
    let dayCount = 0;
    
    mlInsights.forecastArray.forEach((dailyForecast, index) => {
      const forecastDate = new Date(now.getTime() + (index + 1) * 24 * 60 * 60 * 1000);
      const weekKey = forecastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      weekAccum += dailyForecast;
      dayCount += 1;
      
      // Every 7 days or at the end, add a weekly summary
      if (dayCount === 7 || index === mlInsights.forecastArray.length - 1) {
        forecastData.push({
          week: weekKey,
          actualTickets: null as number | null,
          forecastTarget: Math.round(weekAccum / dayCount),
          capacityThreshold: currentStaffCount * agentCapacityTarget,
          isHistorical: false,
        });
        weekAccum = 0;
        dayCount = 0;
      }
    });

    return [...historicalData, ...forecastData];
  }, [weeklyGroupData, mlInsights.forecastArray, currentStaffCount, agentCapacityTarget]);

  const teamStaffingAnalysis = useMemo(() => {
    return assignmentGroups
      .map((group) => {
        const groupTicketsForTeam = currentTickets.filter((ticket: any) => ticket.assignment_group_id === group.assignment_group_id);
        const groupNonFCR = groupTicketsForTeam.filter(isActionableNonFCRTicket);
        const assignedAgentIds = new Set(groupTicketsForTeam
          .map((ticket: any) => ticket.assigned_to_id)
          .filter((value): value is number => typeof value === 'number'));
        const currentStaff = assignedAgentIds.size > 0 ? assignedAgentIds.size : 1;
        const forecastVolume = groupTicketsForTeam.length > 0 ? groupTicketsForTeam.length : 0;
        const required = Math.ceil(forecastVolume / agentCapacityTarget);
        const gap = required - currentStaff;
        const demandRatio = forecastVolume / Math.max(currentStaff * agentCapacityTarget, 1);
        const loadPerAgent = forecastVolume / Math.max(currentStaff, 1);
        const avgRisk = groupNonFCR.length > 0
          ? groupNonFCR.reduce((sum, ticket: any) => sum + (riskScoreMap[ticket.ticket_id]?.riskScore ?? 0), 0) / groupNonFCR.length
          : 0;

        return {
          groupId: group.assignment_group_id,
          groupName: group.group_name,
          forecastVolume,
          currentStaff,
          requiredStaff: required,
          staffingGap: gap,
          demandCapacityRatio: Number(demandRatio.toFixed(2)),
          workloadPerAgent: Number(loadPerAgent.toFixed(1)),
          avgRisk: Number(avgRisk.toFixed(1)),
          recommendation: demandRatio > 1.1 ? `Hire ${Math.max(gap, 1)} agent${Math.max(gap, 1) === 1 ? '' : 's'}` : demandRatio >= 0.9 ? 'Redistribute workload' : 'Maintain staffing',
        };
      })
      .sort((a, b) => b.staffingGap - a.staffingGap);
  }, [assignmentGroups, currentTickets, riskScoreMap, agentCapacityTarget]);

  useEffect(() => {
    let isMounted = true;

    const loadRiskScores = async () => {
      if (groupNonFCRTicketRecords.length === 0) {
        setRiskScoreMap({});
        setRiskError(null);
        setRiskLoading(false);
        return;
      }

      setRiskLoading(true);
      setRiskError(null);

      try {
        const scores = await predictNonFCRRisk(groupNonFCRTicketRecords, currentTickets);
        if (!isMounted) return;
        setRiskScoreMap(Object.fromEntries(scores.map(score => [score.ticket_id, score])));
      } catch (error: any) {
        if (!isMounted) return;
        console.warn('Failed to load ML risk scores', error);
        setRiskError('ML scoring unavailable, using fallback heuristics');
      } finally {
        if (isMounted) {
          setRiskLoading(false);
        }
      }
    };

    loadRiskScores();

    return () => {
      isMounted = false;
    };
  }, [groupNonFCRTicketRecords, currentTickets]);

  // Fetch workload recommendations from ML service for this group
  useEffect(() => {
    let isMounted = true;
    const fetchRecommendations = async () => {
      setRecLoading(true);
      setRecError(null);
      try {
        const payload = {
          assignment_group_id: selectedGroupId,
          incoming_tickets: Math.round(mlInsights.forecastMean ?? groupTickets.length),
          target_date: new Date().toISOString(),
          team_members: teamMemberMetrics
        };

        const resp = await fetch(`${apiBase.replace(/\/$/, '')}/api/ml/workload/balance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!resp.ok) throw new Error('Backend did not return recommendations');
        const data = await resp.json();
        if (isMounted) setWorkloadBalance(data);

        let tasks: Ticket[] = [];
        // Preferred shape: data.recommended_tasks: [ { ticket_id, priority_id, category_id, status_id, created_date, made_sla } ]
        if (Array.isArray(data?.recommended_tasks)) {
          tasks = data.recommended_tasks as Ticket[];
        } else if (Array.isArray(data?.recommendations)) {
          // Flatten per-agent recommendations if present
          data.recommendations.forEach((r: any) => {
            if (Array.isArray(r.tickets)) tasks.push(...r.tickets);
          });
        }

        // Fallback: local prioritized ordering when backend doesn't return tasks
        if (tasks.length === 0) {
          tasks = [...groupTickets]
            .sort((a, b) => (a.priority_id - b.priority_id) || (new Date(b.created_date).getTime() - new Date(a.created_date).getTime()))
            .slice(0, 50);
        }

        if (isMounted) setRecommendations(tasks);
      } catch (error) {
        console.warn('Failed to load ML recommendations', error);
        if (isMounted) {
          setRecError('ML recommendations unavailable — showing priority-sorted fallback');
          setWorkloadBalance(fallbackWorkloadBalance);
          setRecommendations(
            [...groupTickets]
              .sort((a, b) => (a.priority_id - b.priority_id) || (new Date(b.created_date).getTime() - new Date(a.created_date).getTime()))
              .slice(0, 50)
          );
        }
      } finally {
        if (isMounted) setRecLoading(false);
      }
    };

    fetchRecommendations();
    return () => { isMounted = false; };
  }, [apiBase, selectedGroupId, mlInsights.forecastMean, groupTickets]);

  useEffect(() => {
    let isMounted = true;

    const loadMlInsights = async () => {
      setMlInsights((current) => ({ ...current, loading: true, error: null }));

      try {
        const [forecastResponse, anomalyResponse] = await Promise.all([
          fetch(`${apiBase.replace(/\/$/, '')}/api/ml/forecast/tickets`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              assignment_group_id: selectedGroupId,
              days_ahead: 90
            })
          }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/ml/anomalies/detect?group_id=${selectedGroupId}`)
        ]);

        if (!forecastResponse.ok || !anomalyResponse.ok) {
          throw new Error('Failed to load backend ML insights');
        }

        const forecastData = await forecastResponse.json();
        const anomalyData = await anomalyResponse.json();

        const anomalyEntries = Array.isArray(anomalyData?.anomalies_detected) ? anomalyData.anomalies_detected as Array<{ value?: number }> : [];
        const peakAnomaly = anomalyEntries.reduce((max, entry) => Math.max(max, Number(entry?.value ?? 0)), 0);

        if (!isMounted) return;

        const forecastArray = Array.isArray(forecastData?.forecast) ? forecastData.forecast : [];
        const forecastMean = forecastArray.length > 0 ? forecastArray.reduce((sum: number, v: number) => sum + v, 0) / forecastArray.length : null;
        const forecastUpperArray = Array.isArray(forecastData?.upper_bound) ? forecastData.upper_bound : [];
        const forecastLowerArray = Array.isArray(forecastData?.lower_bound) ? forecastData.lower_bound : [];

        setMlInsights({
          forecastMean,
          forecastUpper: forecastUpperArray.length > 0 ? Math.max(...forecastUpperArray) : null,
          forecastLower: forecastLowerArray.length > 0 ? Math.min(...forecastLowerArray) : null,
          forecastArray,
          forecastUpperArray,
          forecastLowerArray,
          anomalyCount: Number(anomalyData?.total_anomalies ?? anomalyEntries.length ?? 0),
          anomalyPeak: Number.isFinite(peakAnomaly) ? peakAnomaly : null,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (!isMounted) return;
        console.warn('Failed to load backend ML insights', error);
        setMlInsights((current) => ({
          ...current,
          loading: false,
          error: 'Backend ML insights unavailable'
        }));
      }
    };

    loadMlInsights();

    return () => {
      isMounted = false;
    };
  }, [apiBase, selectedGroupId]);

  useEffect(() => {
    if (teamMemberMetrics.length === 0) return;
    let isMounted = true;

    const loadWorkloadAnalysis = async () => {
      setImbalanceLoading(true);
      setWorkloadMlError(null);

      try {
        const resp = await fetch(`${apiBase.replace(/\/$/, '')}/api/ml/workload/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ team_members: teamMemberMetrics })
        });

        if (!resp.ok) throw new Error('Failed to load workload analysis');
        const data = await resp.json();
        if (!isMounted) return;
        setWorkloadAnalysis(data);
      } catch (error: any) {
        if (!isMounted) return;
        console.warn('Failed to load ML workload analysis', error);
        setWorkloadMlError('Workload diagnostics unavailable');
        setWorkloadAnalysis(null);
      } finally {
        if (isMounted) setImbalanceLoading(false);
      }
    };

    const loadImbalanceAnalysis = async () => {
      setImbalanceLoading(true);
      try {
        const resp = await fetch(`${apiBase.replace(/\/$/, '')}/api/ml/diagnostics/imbalance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_workloads: teamMemberMetrics.map((agent) => ({
              employee_id: agent.user_id,
              employee_name: agent.employee_name,
              current_workload: agent.current_tickets,
            }))
          })
        });

        if (!resp.ok) throw new Error('Failed to load imbalance analysis');
        const data = await resp.json();
        if (!isMounted) return;
        setImbalanceAnalysis(data);
      } catch (error: any) {
        if (!isMounted) return;
        console.warn('Failed to load imbalance analysis', error);
        setImbalanceAnalysis(null);
      } finally {
        if (isMounted) setImbalanceLoading(false);
      }
    };

    loadWorkloadAnalysis();
    loadImbalanceAnalysis();

    return () => { isMounted = false; };
  }, [apiBase, selectedGroupId, teamMemberMetrics]);

  const computeAgentFcrHistory = (agentId?: number): number => {
    const agentTickets = currentTickets.filter(t => t.assigned_to_id === agentId);
    if (agentTickets.length === 0) return 0.7;
    return agentTickets.filter(t => t.fcr).length / agentTickets.length;
  };

  const computeCategoryNonFcrRate = (categoryId: number): number => {
    const categoryTickets = currentTickets.filter(t => t.category_id === categoryId);
    if (categoryTickets.length === 0) return 0.3;
    return categoryTickets.filter(isActionableNonFCRTicket).length / categoryTickets.length;
  };

  // Active tickets based on filter
  let filteredTickets = groupTickets;
  if (filterStatus === 'active') {
    filteredTickets = groupTickets.filter(t => [1, 2, 7].includes(Number(t.status_id)));
  } else if (filterStatus === 'new') {
    filteredTickets = groupTickets.filter(t => t.status_id === 1);
  } else if (filterStatus === 'closed') {
    filteredTickets = groupTickets.filter(t => t.status_id === 3 || t.status_id === 4);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Team Manager Dashboard</h1>
        <p className="text-gray-600 mt-1">Logged in as: {user?.name || 'Manager'} ({user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Manager'})</p>
        <p className="text-gray-600 mt-1">Viewing tickets for: {displayGroup?.group_name || `Group ${displayGroupId}`}</p>
        {isFallbackGroup && (
          <>
            <div className="mt-2 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
              No non-FCR data exists for the selected team. Showing sample data for {displayGroup?.group_name || `Group ${displayGroupId}`} so ML behavior can be validated.
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 p-3 bg-white">
                <p className="text-xs font-semibold text-slate-500">FCR Risk Distribution</p>
                <div className="mt-2 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={riskDistributionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#EF4444" name="Tickets" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 bg-white">
                <p className="text-xs font-semibold text-slate-500">Top Non-FCR Drivers</p>
                <div className="mt-2 h-40 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={driverFrequencyData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={(entry) => `${entry.name}` }>
                        {driverFrequencyData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={["#4F46E5","#10B981","#F59E0B","#EF4444","#8B5CF6","#06B6D4"][idx % 6]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
        {/* Group selector - only shown for admins, not for managers */}
        {user?.role === 'admin' && (
          <div className="mt-3 flex flex-wrap gap-3 items-center">
            {assignmentGroups.map(group => (
              <button
                key={group.assignment_group_id}
                type="button"
                onClick={() => setSelectedGroupId(group.assignment_group_id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${selectedGroupId === group.assignment_group_id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                {group.group_name}
              </button>
            ))}
          </div>
        )}
        <div className="mt-4">
          <div className="inline-flex rounded-md bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setSelectedTab('overview')}
              className={`px-3 py-1 text-sm font-medium rounded ${selectedTab === 'overview' ? 'bg-white text-slate-900 shadow' : 'text-slate-700'}`}>
              Overview
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards for Manager's Group */}
      {selectedTab === 'overview' && (
        <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">SLA Compliance</CardTitle>
            <Target className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{hasData ? `${groupKPIs.slaCompliance.toFixed(1)}%` : 'N/A'}</div>
            <p className="text-xs text-gray-500 mt-1">{hasData ? `${groupKPIs.totalTickets} total tickets` : 'No data'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">FCR Rate</CardTitle>
            <Activity className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{hasData ? `${groupKPIs.fcrRate.toFixed(1)}%` : 'N/A'}</div>
            <p className="text-xs text-gray-500 mt-1">First contact resolution</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Tickets</CardTitle>
            <Users className="w-4 h-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{hasData ? groupKPIs.activeTickets : 'N/A'}</div>
            <p className="text-xs text-gray-500 mt-1">Requiring attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Non-FCR Alerts</CardTitle>
            <AlertTriangle className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{hasData ? groupHighRiskNonFCRTicketRecords.length : 'N/A'}</div>
            <p className="text-xs text-gray-500 mt-1">High-risk tickets needing review</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Non-FCR Risk Summary</CardTitle>
          <p className="text-xs text-gray-500 mt-1">
            Agent and category-level non-FCR risk guidance for {displayGroup?.group_name || `Group ${displayGroupId}`}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">High-risk actionable tickets</p>
              <p className="mt-2 text-2xl font-bold text-rose-600">{groupHighRiskNonFCRTicketRecords.length}</p>
              <p className="text-sm text-slate-600">Tickets with risk over 50%</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Agent problem signals</p>
              <p className="mt-2 text-2xl font-bold text-blue-600">{agentProblemRows.length}</p>
              <p className="text-sm text-slate-600">Agents flagged for coaching or escalation</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Category problem signals</p>
              <p className="mt-2 text-2xl font-bold text-amber-600">{categoryProblemRows.length}</p>
              <p className="text-sm text-slate-600">Categories needing process or training support</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Agent problems</h3>
                <span className="text-xs text-slate-500">ML-assisted risk view</span>
              </div>
              <div className="space-y-2">
                {agentProblemRows.length === 0 ? (
                  <p className="text-sm text-slate-500">No agent problem patterns available yet.</p>
                ) : (
                  agentProblemRows.map((row) => {
                    const agent = getUserById(row.agentId);
                    const agentName = agent ? `${agent.first_name} ${agent.last_name}` : `Agent ${row.agentId}`;
                    return (
                      <div key={row.agentId} className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-800">{agentName}</p>
                            <p className="text-xs text-slate-500">{row.ticketCount} high-risk tickets</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-blue-700">{Math.round(row.avgRisk)}%</p>
                            <p className="text-xs text-slate-600">avg risk score</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Category problems & recommendations</h3>
                <span className="text-xs text-slate-500">Process and coaching guidance</span>
              </div>
              <div className="space-y-2">
                {categoryProblemRows.length === 0 ? (
                  <p className="text-sm text-slate-500">No category problem patterns available yet.</p>
                ) : (
                  categoryProblemRows.map((row) => (
                    <div key={row.categoryId} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-800">{row.categoryName}</p>
                          <p className="mt-1 text-xs text-slate-500">{row.problemTypeLabel}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-slate-700">{Math.round(row.avgRisk)}%</p>
                          <p className="text-xs text-slate-500">avg risk score</p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className="rounded-full bg-slate-100 px-2 py-1">FCR {Math.round(row.fcrRate)}%</span>
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">{row.recommendation}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={riskDetailsOpen} onOpenChange={setRiskDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Risk Detail</DialogTitle>
            <DialogDescription>
              This view shows a sample ticket and the underlying category/agent risk drivers.
            </DialogDescription>
          </DialogHeader>
          {selectedRiskRow ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-600">Category</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{getCategoryName(selectedRiskRow.categoryId)}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Category FCR Rate</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{Number(selectedRiskRow.categoryFCRRate).toFixed(1)}%</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Agent FCR Rate</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{Number(selectedRiskRow.agentCategoryFCRRate).toFixed(1)}%</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Recommended action</p>
                <p className="mt-1 text-base text-slate-900">{selectedRiskRow.action}</p>
              </div>
              {selectedRiskRow.sampleTickets && selectedRiskRow.sampleTickets.length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Flagged tickets ({selectedRiskRow?.sampleTickets?.length ?? 0})</p>
                  <div className="mt-2 max-h-48 overflow-auto text-sm text-slate-700 space-y-2">
                    {selectedRiskRow.sampleTickets.map((t: any) => (
                      <div key={t.ticket_id} className="rounded p-2 border border-slate-100 bg-slate-50">
                        <div><span className="font-semibold">Ticket:</span> {t.ticket_id}</div>
                        <div><span className="font-semibold">Status:</span> {t.status_id}</div>
                        <div><span className="font-semibold">Created:</span> {t.created_date}</div>
                        <div><span className="font-semibold">Assignee:</span> {t.assigned_to_id ?? 'Unassigned'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-600">No flagged tickets found for this risk row.</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-600">Select a row to view more details.</p>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRiskDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Live ML Insights card removed (UI only). ML data loading retained for other features. */}

      {/* Staffing Decision Center removed UI-only. Keeping hardware category workload below when applicable. */}

      {/* Hardware-only: keep category workload chart for Hardware team (group 4) */}
      {selectedGroupId === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>{displayGroup?.group_name || `Group ${displayGroupId}`} category workload</CardTitle>
            <p className="text-xs text-gray-500 mt-1">Category workload visualization for Hardware team</p>
          </CardHeader>
          <CardContent>
            <div className="mt-3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={categoryLoadData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="category" type="category" width={140} />
                  <Tooltip />
                  <Bar dataKey="tickets" fill="#4F46E5" radius={[0, 6, 6, 0]} name="Tickets" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Team staffing gap analysis</CardTitle>
          <p className="text-xs text-gray-500 mt-1">Cross-team staffing needs by forecast volume, capacity utilization, and workload risk.</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Team</th>
                  <th className="text-left">Forecast volume</th>
                  <th className="text-left">Current staff</th>
                  <th className="text-left">Required staff</th>
                  <th className="text-left">Gap</th>
                  <th className="text-left">Load / agent</th>
                  <th className="text-left">Avg risk</th>
                  <th className="text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {teamStaffingAnalysis.map((entry) => (
                  <tr key={entry.groupId} className={entry.groupId === displayGroupId ? 'bg-indigo-50' : undefined}>
                    <td className="font-medium">{entry.groupName}</td>
                    <td>{entry.forecastVolume}</td>
                    <td>{entry.currentStaff}</td>
                    <td>{entry.requiredStaff}</td>
                    <td className={entry.staffingGap > 0 ? 'font-semibold text-rose-600' : 'font-semibold text-emerald-600'}>{entry.staffingGap >= 0 ? `+${entry.staffingGap}` : entry.staffingGap}</td>
                    <td>{entry.workloadPerAgent.toFixed(1)} tickets</td>
                    <td>{entry.avgRisk.toFixed(1)}%</td>
                    <td>{entry.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ML workload diagnostics removed (UI-only). Workload ML calls remain for backend logic. */}

      {/* Task Allocation & Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Task Allocation Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={taskAllocationData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {taskAllocationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{newTasks}</div>
                <p className="text-xs text-gray-500">New Tasks</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{assignedTasks}</div>
                <p className="text-xs text-gray-500">Assigned</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600">{pendingTasks}</div>
                <p className="text-xs text-gray-500">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Forecast vs actual workload</CardTitle>
            <p className="text-xs text-gray-500 mt-1">Actual ticket volume versus forecast target and capacity threshold for {displayGroup?.group_name || `Group ${displayGroupId}`}</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weightedForecastData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <ReferenceLine y={currentStaffCount * agentCapacityTarget} stroke="#F59E0B" strokeDasharray="4 4" label="Capacity threshold" />
                <Line type="monotone" dataKey="actualTickets" stroke="#4F46E5" strokeWidth={2} name="Actual tickets" />
                <Line type="monotone" dataKey="forecastTarget" stroke="#10B981" strokeWidth={2} strokeDasharray="4 4" name="Forecast target" />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3 text-xs text-gray-600">Capacity threshold is derived from {currentStaffCount} current agents × {agentCapacityTarget} tickets/agent. Values above the threshold indicate overload and potential hiring or redistribution.</div>
          </CardContent>
        </Card>
      </div>

      {/* Non-FCR Detection List */}
      <div className="grid grid-cols-1 gap-6">
        <div>
          <NonFCRRiskPanel tickets={groupHighRiskNonFCRTicketRecords} riskScoreMap={riskScoreMap} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Non-FCR Detection List - Action Required</CardTitle>
          <p className="text-xs text-gray-500 mt-1">
            Tickets requiring follow-up or escalation
            {riskLoading ? ' · Loading ML scores…' : riskError ? ` · ${riskError}` : ''}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600">Showing {groupHighRiskNonFCRTicketRecords.length} high-risk non-FCR tickets</div>
            <div className="flex items-center space-x-2">
              <Button size="sm" disabled={nfcrPage === 0} onClick={() => setNfcrPage(p => Math.max(0, p - 1))}>Prev</Button>
              <div className="text-sm text-gray-700">Page {nfcrPage + 1} / {nfcrTotalPages}</div>
              <Button size="sm" disabled={nfcrPage + 1 >= nfcrTotalPages} onClick={() => setNfcrPage(p => Math.min(nfcrTotalPages - 1, p + 1))}>Next</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Ticket ID</th>
                  <th className="text-left p-3 font-medium">Priority</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Risk</th>
                  <th className="text-left p-3 font-medium">Action</th>
                  <th className="text-left p-3 font-medium">Age (days)</th>
                  <th className="text-left p-3 font-medium">Reopens</th>
                </tr>
              </thead>
              <tbody>
                {groupHighRiskNonFCRTicketRecords.length === 0 ? (
                  <tr className="border-b hover:bg-gray-50">
                    <td className="p-3 text-sm text-gray-500" colSpan={8}>
                      No high-risk non-FCR tickets found for this team. Check that ML risk scores are available and that tickets are flagged correctly.
                    </td>
                  </tr>
                ) : nfcrPageTickets.map(ticket => {
                  const age = Math.floor(
                    (new Date().getTime() - new Date(ticket.created_date).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  const fullTicket = groupTickets.find(t => t.ticket_id === ticket.ticket_id);
                  const priorityLabel = getPriorityLabel(ticket.priority_id);
                  const categoryLabel = getCategoryName(ticket.category_id);
                  const statusLabel = getStatusName(fullTicket?.status_id);
                  return (
                    <tr key={ticket.ticket_id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-mono text-xs font-medium">{ticket.ticket_id}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          ticket.priority_id === 1 ? 'bg-red-100 text-red-800' :
                          ticket.priority_id === 2 ? 'bg-orange-100 text-orange-800' :
                          ticket.priority_id === 3 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {priorityLabel}
                        </span>
                      </td>
                      <td className="p-3">{categoryLabel}</td>
                      <td className="p-3 text-xs">
                        {statusLabel}
                      </td>
                      <td className="p-3">
                        {riskScoreMap[ticket.ticket_id] ? (
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            riskScoreMap[ticket.ticket_id].riskScore >= 70 ? 'bg-red-100 text-red-800' :
                            riskScoreMap[ticket.ticket_id].riskScore >= 50 ? 'bg-orange-100 text-orange-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {riskScoreMap[ticket.ticket_id].riskScore}%
                          </span>
                        ) : 'N/A'}
                      </td>
                      <td className="p-3 text-sm text-slate-700">
                        {riskScoreMap[ticket.ticket_id]?.recommendation ?? 'Monitor ticket'}
                      </td>
                      <td className="p-3">{age}d</td>
                      <td className="p-3 text-center">
                        {(fullTicket?.reopen_count ?? 0) > 0 ? (
                          <span className="px-2 py-1 rounded text-xs text-gray-700">{fullTicket?.reopen_count}</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </CardContent>
      </Card>

      

      {/* Agent FCR Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Agent First Contact Resolution (FCR) Performance</CardTitle>
          <p className="text-xs text-gray-500 mt-1">Agents by FCR rate - identify training needs</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Agent</th>
                  <th className="text-left p-3 font-medium">Tickets Resolved</th>
                  <th className="text-left p-3 font-medium">FCR Rate</th>
                  <th className="text-left p-3 font-medium">FCR Count</th>
                  <th className="text-left p-3 font-medium">Non-FCR</th>
                </tr>
              </thead>
              <tbody>
                {getEmployeePerformance(currentTickets)
                  .sort((a, b) => b.ticketsResolved - a.ticketsResolved)
                  .slice(0, 10)
                  .map(agent => {
                    const agentTickets = currentTickets.filter(t => t.assigned_to_id === agent.userId);
                    const fcrCount = agentTickets.filter(t => t.fcr === true).length;
                    const nonFcrCount = agentTickets.filter(t => t.fcr === false).length;
                    const user = getUserById(agent.userId);
                    const fcrColor = agent.fcrRate >= 80 ? 'text-green-600' : agent.fcrRate >= 60 ? 'text-yellow-600' : 'text-red-600';
                    
                    return (
                      <tr key={agent.userId} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{user?.first_name} {user?.last_name}</td>
                        <td className="p-3">{agent.ticketsResolved}</td>
                        <td className={`p-3 font-bold ${fcrColor}`}>{agent.fcrRate.toFixed(1)}%</td>
                        <td className="p-3 text-green-600">{fcrCount}</td>
                        <td className="p-3 text-red-600">{nonFcrCount > 0 ? nonFcrCount : '—'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Active Tickets List with Filters */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Active Tickets</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('all')}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={filterStatus === 'new' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('new')}
            >
              New ({newTasks})
            </Button>
            <Button
              size="sm"
              variant={filterStatus === 'active' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('active')}
            >
              Active ({groupKPIs.activeTickets})
            </Button>
            <Button
              size="sm"
              variant={filterStatus === 'closed' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('closed')}
            >
              Closed
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm text-gray-600">Showing {filteredTickets.length} tickets</div>
            <div className="text-xs text-gray-500">Scroll to view all tickets</div>
          </div>
          <div className="overflow-x-auto">
            <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Ticket ID</th>
                    <th className="text-left p-3 font-medium">Description</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Priority</th>
                    <th className="text-left p-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map(ticket => (
                    <tr key={ticket.ticket_id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-mono text-xs font-medium">{ticket.ticket_id}</td>
                      <td className="p-3 truncate max-w-xs">{ticket.short_description}</td>
                      <td className="p-3 text-xs">
                        <span className={`px-2 py-1 rounded text-xs ${
                          ticket.status_id === 1 ? 'bg-blue-100 text-blue-800' :
                          ticket.status_id === 2 ? 'bg-purple-100 text-purple-800' :
                          ticket.status_id === 3 ? 'bg-green-100 text-green-800' :
                          ticket.status_id === 4 ? 'bg-gray-100 text-gray-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {getStatusName(ticket.status_id)}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          ticket.priority_id === 1 ? 'bg-red-100 text-red-800' :
                          ticket.priority_id === 2 ? 'bg-orange-100 text-orange-800' :
                          ticket.priority_id === 3 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {getPriorityLabel(ticket.priority_id)}
                        </span>
                      </td>
                      <td className="p-3 text-xs">
                        {new Date(ticket.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
      </>
    )}
    {/* Recommended Allocation view removed per request. Recommendation logic and ML calls remain active. */}
    </div>
  );
}
