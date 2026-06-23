# ML Tuning Context (Service Desk Redistribution)

This document captures the current machine-learning and decision-tree context for tuning Master Recommendation Summary behavior.

## Scope

This tuning context applies to:
- Frontend decision and summary logic in `frontend/src/app/pages/dashboards/ManagerDashboard.tsx`
- Existing backend and ML endpoints already used by the dashboard

This does **not** replace existing ML modules. It tunes gating and interpretation of outputs.

## Current Behavioral Model

The system uses a layered approach:
1. Base ML outputs remain active (forecasting, anomaly, risk, workload outputs).
2. A decision-tree gate controls whether Master Recommendation Summary is shown as actionable.
3. Redistribution pressure is based on active tickets (New, In Progress, Pending).
4. Recommendation rows aggregate by specialized target group (category ownership mapping).

## Core Objective

Only recommend redistribution when all are true:
1. Service Desk active workload is materially overloaded.
2. KPI decay is substantial (not minor variance).
3. Predicted KPI uplift from redistribution is meaningful.

If those are not met, stay in normal/watch mode.

## Tuning Inputs

### Overload Signals
- `activeTicketCount`
- `activeLoadPerAgent`
- `activeCapacityRatio`

### KPI Vulnerability Signals
- `groupKPIs.slaCompliance`
- `groupKPIs.fcrRate`

### Uplift Signals
- `predictedKpiImprovements.sla_compliance_gain_pct`
- `predictedKpiImprovements.fcr_rate_gain_pct`
- Heuristic fallback uplift when modeled gains are sparse

## Practical Tuning Knobs

Tune these incrementally (small changes first):
1. Overload threshold (capacity ratio trigger)
2. SLA vulnerability threshold
3. FCR vulnerability threshold
4. Minimum meaningful SLA gain
5. Minimum meaningful FCR gain
6. Minimum active ticket sample size

Recommended process:
- Change one knob at a time.
- Rebuild and recheck summary output in manager dashboard.
- Compare with historical expected outcomes.

## Guardrails

1. Do not trigger large redistribution on load alone.
2. Do not redistribute when KPI risk is weak.
3. Keep summary constrained to active tickets for operational relevance.
4. Avoid self-target redistribution rows.
5. Aggregate by destination team to avoid duplicate noisy rows.

## Data/Mapping Notes

Category routing currently depends on assignment group ownership mapping in frontend logic.
If category IDs or names drift, recommendation rows may route incorrectly.

Keep mapping synchronized with source-of-truth taxonomy.

## Validation Checklist

After each tuning change:
1. Frontend build passes.
2. Master Recommendation state transitions are sensible: normal -> watch -> triggered.
3. No redistribution rows appear for healthy KPI + manageable load.
4. At least one row appears for severe overload + KPI decay + uplift potential.
5. Suggested teams are external and category-compatible.
6. Expected SLA/FCR gain values are non-zero only when justified.

## Rollback Strategy

If behavior regresses:
1. Reset branch to last known-good commit.
2. Reapply tuning changes in smaller increments.
3. Revalidate with same seeded dataset for consistency.

## Branching Guidance

Use feature branch iteration for tuning and merge to main only after:
- Build/test checks pass
- UI output matches operational intent
- Team review confirms recommendation realism
