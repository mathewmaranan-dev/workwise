import { useEffect, useMemo, useState } from 'react';

export interface LookupCategory {
  category_id: number;
  category_name: string;
}

export interface LookupStatus {
  status_id: number;
  status_name: string;
}

export interface LookupPriority {
  priority_id: number;
  priority_level: string;
}

export function useLookupData(apiBase: string, authToken?: string) {
  const [categories, setCategories] = useState<LookupCategory[]>([]);
  const [statuses, setStatuses] = useState<LookupStatus[]>([]);
  const [priorities, setPriorities] = useState<LookupPriority[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const base = apiBase?.replace(/\/$/, '') || '';
    if (!base) {
      setCategories([]);
      setStatuses([]);
      setPriorities([]);
      setLoading(false);
      return;
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`${base}/api/lookups/categories`, { method: 'GET', headers }),
      fetch(`${base}/api/lookups/statuses`, { method: 'GET', headers }),
      fetch(`${base}/api/lookups/priorities`, { method: 'GET', headers }),
    ])
      .then(async ([catRes, statusRes, priorityRes]) => {
        if (!catRes.ok) throw new Error('Failed to load categories');
        if (!statusRes.ok) throw new Error('Failed to load statuses');
        if (!priorityRes.ok) throw new Error('Failed to load priorities');

        const [catData, statusData, priorityData] = await Promise.all([
          catRes.json(),
          statusRes.json(),
          priorityRes.json(),
        ]);

        if (!mounted) return;
        setCategories(Array.isArray(catData) ? catData : []);
        setStatuses(Array.isArray(statusData) ? statusData : []);
        setPriorities(Array.isArray(priorityData) ? priorityData : []);
      })
      .catch((err) => {
        console.warn('Failed to load lookup data', err);
        if (!mounted) return;
        setError(String(err));
        setCategories([]);
        setStatuses([]);
        setPriorities([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [apiBase]);

  const getCategoryName = useMemo(
    () => (id: number | string | undefined | null) => {
      if (id === null || id === undefined || id === '') return 'Unknown';
      const found = categories.find((c) => Number(c.category_id) === Number(id));
      return found?.category_name ?? `Category ${id}`;
    },
    [categories]
  );

  const getStatusName = useMemo(
    () => (id: number | string | undefined | null) => {
      if (id === null || id === undefined || id === '') return 'Unknown';
      const found = statuses.find((s) => Number(s.status_id) === Number(id));
      return found?.status_name ?? `Status ${id}`;
    },
    [statuses]
  );

  const getPriorityLabel = useMemo(
    () => (id: number | string | undefined | null) => {
      if (id === null || id === undefined || id === '') return 'Unknown';
      const found = priorities.find((p) => Number(p.priority_id) === Number(id));
      return found?.priority_level ?? `Priority ${id}`;
    },
    [priorities]
  );

  return {
    categories,
    statuses,
    priorities,
    loading,
    error,
    getCategoryName,
    getStatusName,
    getPriorityLabel,
  };
}
