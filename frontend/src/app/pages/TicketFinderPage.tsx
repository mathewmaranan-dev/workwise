import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { assignmentGroups, categories, priorities, statuses, getCategoryById } from '../data/seedData';
import { useAuth } from '../context/AuthContext';

const env = (import.meta as any).env as Record<string, string | undefined>;
const API_BASE = env.VITE_API_BASE_URL || env.VITE_API_URL || 'http://localhost:5000';
const EMPTY_OPTION_VALUE = '__any';

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value && value.trim() !== '' && value !== EMPTY_OPTION_VALUE) {
      search.set(key, value.trim());
    }
  });

  return search.toString() ? `?${search.toString()}` : '';
}

export default function TicketFinderPage() {
  const { user, users } = useAuth();
  const [ticketId, setTicketId] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [assignmentGroupId, setAssignmentGroupId] = useState(EMPTY_OPTION_VALUE);
  const [categoryId, setCategoryId] = useState(EMPTY_OPTION_VALUE);
  const [statusId, setStatusId] = useState(EMPTY_OPTION_VALUE);
  const [priorityId, setPriorityId] = useState(EMPTY_OPTION_VALUE);
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoriesFromApi, setCategoriesFromApi] = useState<{ category_id: number; category_name: string }[]>([]);
  const [statusesFromApi, setStatusesFromApi] = useState<{ status_id: number; status_name: string }[]>([]);
  const [prioritiesFromApi, setPrioritiesFromApi] = useState<{ priority_id: number; priority_level: string }[]>([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const canAccess = useMemo(() => {
    return user && ['admin', 'manager'].includes(user.role);
  }, [user]);

  useEffect(() => {
    if (canAccess) {
      handleSearch();
    }
  }, [canAccess]);

  // Load categories from backend so dropdowns reflect the DB
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('workwise_token') : null;
    const base = API_BASE ? API_BASE.replace(/\/$/, '') : '';
    if (!base) return;

    Promise.all([
      fetch(`${base}/api/lookups/categories`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      }),
      fetch(`${base}/api/lookups/statuses`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      }),
      fetch(`${base}/api/lookups/priorities`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      }),
    ])
      .then(async ([categoriesRes, statusesRes, prioritiesRes]) => {
        if (!categoriesRes.ok) throw new Error('Failed to load categories');
        if (!statusesRes.ok) throw new Error('Failed to load statuses');
        if (!prioritiesRes.ok) throw new Error('Failed to load priorities');

        const [cats, stats, pris] = await Promise.all([categoriesRes.json(), statusesRes.json(), prioritiesRes.json()]);
        setCategoriesFromApi(Array.isArray(cats) ? cats : []);
        setStatusesFromApi(Array.isArray(stats) ? stats : []);
        setPrioritiesFromApi(Array.isArray(pris) ? pris : []);
      })
      .catch((err) => {
        console.warn('Failed to load lookups for ticket finder', err);
        setCategoriesFromApi([]);
        setStatusesFromApi([]);
        setPrioritiesFromApi([]);
      });
  }, [API_BASE]);

  async function handleSearch(pageArg?: number) {
    setLoading(true);
    setError(null);

    try {
      const usedPage = typeof pageArg === 'number' ? pageArg : 1;
      setPage(usedPage);
      const query = buildQuery({
        ticket_id: ticketId,
        assigned_to_id: assignedToId,
        assignment_group_id: assignmentGroupId,
        category_id: categoryId,
        status_id: statusId,
        priority_id: priorityId,
        created_from: createdFrom,
        created_to: createdTo,
        limit: String(PAGE_SIZE),
        offset: String((usedPage - 1) * PAGE_SIZE),
      });

      const token = typeof window !== 'undefined' ? localStorage.getItem('workwise_token') : null;
      const base = API_BASE ? API_BASE.replace(/\/$/, '') : '';
      const url = `${base}/api/tickets${query}`;
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tickets');
      }

      const data = await response.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      console.error('TicketFinderPage error:', fetchError);
      setError('Unable to load tickets. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  const handleReset = () => {
    setTicketId('');
    setAssignedToId('');
    setAssignmentGroupId(EMPTY_OPTION_VALUE);
    setCategoryId(EMPTY_OPTION_VALUE);
    setStatusId(EMPTY_OPTION_VALUE);
    setPriorityId(EMPTY_OPTION_VALUE);
    setCreatedFrom('');
    setCreatedTo('');
    setResults([]);
    setError(null);
  };

  const resolveName = (name: string | null | undefined) => name || '-';
  
  const resolveStatus = (id: number | string | null | undefined) => {
    if (id == null || id === '') return '-';
    const status = statusesFromApi.find((s) => s.status_id === Number(id)) || statuses.find((s) => s.status_id === Number(id));
    return status?.status_name || String(id);
  };

  const resolvePriority = (id: number | string | null | undefined) => {
    if (id == null || id === '') return '-';
    const priority = prioritiesFromApi.find((p) => p.priority_id === Number(id)) || priorities.find((p) => p.priority_id === Number(id));
    return priority?.priority_level || String(id);
  };

  const resolveGroup = (id: number | string | null | undefined) => {
    if (id == null || id === '') return '-';
    return assignmentGroups.find((g) => g.assignment_group_id === Number(id))?.group_name || String(id);
  };

  const resolveCategory = (id: number | string | null | undefined) => {
    if (id == null || id === '') return '-';
    const byApi = categoriesFromApi.find((c) => Number(c.category_id) === Number(id));
    if (byApi) return byApi.category_name;
    const seed = getCategoryById(Number(id));
    return seed?.category_name || String(id);
  };

  const resolveAssigned = (ticket: any) => {
    const apiFullName = `${String(ticket.assigned_first_name || '').trim()} ${String(ticket.assigned_last_name || '').trim()}`.trim();
    if (apiFullName) {
      return apiFullName;
    }

    const matchedUser = users.find((candidate) => Number(candidate.id) === Number(ticket.assigned_to_id));
    const contextFullName = `${String(matchedUser?.first_name || '').trim()} ${String(matchedUser?.last_name || '').trim()}`.trim();
    if (contextFullName) {
      return contextFullName;
    }

    if (matchedUser?.name) {
      return matchedUser.name;
    }

    return ticket.assigned_to_id ?? '-';
  };

  if (!canAccess) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Access denied</p>
        <p className="mt-2 text-sm text-slate-600">Ticket Finder is available to Admin and Manager users only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Ticket Finder</CardTitle>
            <CardDescription>Filter and search tickets by ID, status, priority, group, assigned user, and date.</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? 'SearchingΓÇª' : 'Search'}
            </Button>
            <Button variant="secondary" onClick={handleReset} disabled={loading}>
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-3">
              <Label htmlFor="ticket-id">Ticket ID</Label>
              <Input
                id="ticket-id"
                value={ticketId}
                onChange={(event) => setTicketId(event.target.value)}
                placeholder="Exact ticket ID"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="assigned-to-id">Assigned To ID</Label>
              <Input
                id="assigned-to-id"
                value={assignedToId}
                onChange={(event) => setAssignedToId(event.target.value)}
                placeholder="Agent user ID"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="assignment-group">Assignment Group</Label>
              <Select
                value={assignmentGroupId}
                onValueChange={(value) => setAssignmentGroupId(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_OPTION_VALUE}>Any group</SelectItem>
                  {assignmentGroups.map((group) => (
                    <SelectItem key={group.assignment_group_id} value={String(group.assignment_group_id)}>
                      {group.group_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label htmlFor="category">Category</Label>
              <Select value={categoryId} onValueChange={(value) => setCategoryId(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_OPTION_VALUE}>Any category</SelectItem>
                  {(categoriesFromApi.length ? categoriesFromApi : categories).map((category: any) => (
                    <SelectItem key={category.category_id} value={String(category.category_id)}>
                      {category.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label htmlFor="status">Status</Label>
              <Select value={statusId} onValueChange={(value) => setStatusId(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_OPTION_VALUE}>Any status</SelectItem>
                  {(statusesFromApi.length ? statusesFromApi : statuses).map((status) => (
                    <SelectItem key={status.status_id} value={String(status.status_id)}>
                      {status.status_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priorityId} onValueChange={(value) => setPriorityId(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_OPTION_VALUE}>Any priority</SelectItem>
                  {(prioritiesFromApi.length ? prioritiesFromApi : priorities).map((priority) => (
                    <SelectItem key={priority.priority_id} value={String(priority.priority_id)}>
                      {priority.priority_level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="created-from">Created From</Label>
                <Input
                  id="created-from"
                  type="date"
                  value={createdFrom}
                  onChange={(event) => setCreatedFrom(event.target.value)}
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="created-to">Created To</Label>
                <Input
                  id="created-to"
                  type="date"
                  value={createdTo}
                  onChange={(event) => setCreatedTo(event.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Results</CardTitle>
            <CardDescription>
              {error
                ? 'There was a problem loading tickets.'
                : `${results.length} ticket${results.length === 1 ? '' : 's'} returned`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Ticket</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Group</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Assigned</th>
                  <th className="px-3 py-2">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                      {loading ? 'Loading ticketsΓÇª' : 'No tickets found. Adjust filters and search again.'}
                    </td>
                  </tr>
                ) : (
                  results.map((ticket) => (
                    <tr key={ticket.ticket_id} className="bg-white">
                      <td className="px-3 py-2 font-medium text-slate-900">{ticket.ticket_id}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {ticket.created_date ? new Date(ticket.created_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {resolveStatus(ticket.status_id)}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {resolvePriority(ticket.priority_id)}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {resolveGroup(ticket.assignment_group_id)}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {resolveCategory(ticket.category_id)}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {resolveAssigned(ticket)}
                      </td>
                      <td className="px-3 py-2 text-slate-600 max-w-lg truncate">
                        {ticket.short_description || 'ΓÇö'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
        <div className="flex items-center justify-end gap-2 p-4">
          <Button onClick={() => { if (page > 1) { const next = page - 1; setPage(next); handleSearch(next); } }} disabled={loading || page === 1}>Previous</Button>
          <div className="text-sm text-slate-600">Page {page}</div>
          <Button onClick={() => { const next = page + 1; setPage(next); handleSearch(next); }} disabled={loading || results.length < PAGE_SIZE}>Next</Button>
        </div>
      </Card>
    </div>
  );
}
