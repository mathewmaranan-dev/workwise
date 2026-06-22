export interface AggregatedTicketRow {
  category_id: number;
  assigned_to_id: number | null;
  total_tickets: number;
  fcr_count: number;
}

export interface AggregatedRiskRow {
  categoryId: number;
  agentId: number | null;
  categoryFCRRate: number;
  agentCategoryFCRRate: number;
  totalTickets: number;
  action: string;
}

export function buildNonFCRAggregatedRows(rows: AggregatedTicketRow[]): AggregatedRiskRow[] {
  const categoryTotals: Record<number, { total: number; fcr: number }> = {};

  rows.forEach((r) => {
    const categoryId = Number(r.category_id) || 0;
    if (!categoryTotals[categoryId]) categoryTotals[categoryId] = { total: 0, fcr: 0 };
    categoryTotals[categoryId].total += Number(r.total_tickets || 0);
    categoryTotals[categoryId].fcr += Number(r.fcr_count || 0);
  });

  return rows.map((r) => {
    const categoryId = Number(r.category_id) || 0;
    const agentId = r.assigned_to_id != null ? Number(r.assigned_to_id) : null;
    const total = Number(r.total_tickets || 0);
    const fcr = Number(r.fcr_count || 0);
    const category = categoryTotals[categoryId] || { total: 0, fcr: 0 };
    const categoryFCRRate = category.total > 0 ? (category.fcr / category.total) * 100 : 0;
    const agentCategoryFCRRate = total > 0 ? (fcr / total) * 100 : 0;

    let action = 'No Risk: retain assignment';
    if (categoryFCRRate < 40 && agentCategoryFCRRate === 0) {
      action = 'Dual Alert: retrain agent and escalate systemic fixes';
    } else if (categoryFCRRate < 40) {
      action = 'Systemic Category Issue: everyone struggles, process fix needed';
    } else if (agentCategoryFCRRate < categoryFCRRate - 20) {
      action = 'Agent Skill Gap: training/coaching needed';
    }

    return {
      categoryId,
      agentId,
      categoryFCRRate: Number(categoryFCRRate.toFixed(2)),
      agentCategoryFCRRate: Number(agentCategoryFCRRate.toFixed(2)),
      totalTickets: total,
      action,
    };
  });
}
