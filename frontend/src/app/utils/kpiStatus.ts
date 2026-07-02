export type KpiStatusMetric = 'sla' | 'fcr';

export interface KpiStatusResult {
  label: string;
  badgeClass: string;
}

const STATUS_STYLES: Record<'performing' | 'improve' | 'critical' | 'no-data', string> = {
  performing: 'border-emerald-300 bg-emerald-100 text-emerald-900',
  improve: 'border-amber-300 bg-amber-100 text-amber-900',
  critical: 'border-rose-300 bg-rose-100 text-rose-900',
  'no-data': 'border-slate-300 bg-slate-100 text-slate-700',
};

export function getKpiStatus(metric: KpiStatusMetric, value: number | null | undefined): KpiStatusResult {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return {
      label: 'No data',
      badgeClass: STATUS_STYLES['no-data'],
    };
  }

  if (metric === 'sla') {
    if (numericValue >= 80) {
      return {
        label: 'Performing',
        badgeClass: STATUS_STYLES.performing,
      };
    }
    if (numericValue >= 70) {
      return {
        label: 'Improve',
        badgeClass: STATUS_STYLES.improve,
      };
    }
    return {
      label: 'Critical underperforming',
      badgeClass: STATUS_STYLES.critical,
    };
  }

  if (numericValue >= 70) {
    return {
      label: 'Performing',
      badgeClass: STATUS_STYLES.performing,
    };
  }
  if (numericValue >= 60) {
    return {
      label: 'Improve',
      badgeClass: STATUS_STYLES.improve,
    };
  }
  return {
    label: 'Critical underperforming',
    badgeClass: STATUS_STYLES.critical,
  };
}
