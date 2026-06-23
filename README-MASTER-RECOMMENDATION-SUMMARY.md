# Master Recommendation Summary

## Purpose
This document defines the logic and behavior for the Master Recommendation Summary section so it can be recreated after any reset.

The summary is derived from the manager workload diagnostics flow and produces actionable rows with:
- Flag
- % Redirect
- Suggested Team
- Expected SLA Gain
- Expected FCR Gain

## Source of Truth
Primary frontend logic currently lives in:
- frontend/src/app/pages/dashboards/ManagerDashboard.tsx

Relevant computed values:
- effectiveWorkloadBalance
- predictedKpiImprovements
- isServiceDeskGroup
- workloadBalanceRecommendations
- workloadRecommendationSummary

## Data Inputs
Master Recommendation Summary depends on these upstream inputs:

1. effectiveWorkloadBalance
- Value: workloadBalance OR fallbackWorkloadBalance
- Expected shape includes recommendations, current_analysis, optimized_analysis, predicted_improvements

2. Group gates
- isGroupImbalanced
- isServiceDeskGroup

3. Recommendations list
- workloadBalanceRecommendations = effectiveWorkloadBalance.recommendations when:
  - effectiveWorkloadBalance exists
  - isGroupImbalanced is true
  - isServiceDeskGroup is true

4. KPI improvement estimates
- predictedKpiImprovements prefers effectiveWorkloadBalance.predicted_improvements when present
- Otherwise, it is computed from fairness and coefficient-of-variation deltas

## KPI Improvement Fallback Formula
When predicted_improvements is missing, compute:

- currentFairness = effectiveWorkloadBalance.current_analysis.fairness_score OR workloadAnalysis.analysis.fairness_score OR 0
- optimizedFairness = effectiveWorkloadBalance.optimized_analysis.fairness_score OR min(1, currentFairness + 0.08)
- currentCv = effectiveWorkloadBalance.current_analysis.coefficient_of_variation OR workloadAnalysis.analysis.coefficient_of_variation OR 0.2
- improvedCv = max(0, currentCv - 0.05)

Then:
- slaGain = clamp((optimizedFairness - currentFairness) * 20 + (currentCv - improvedCv) * 10, 0, 10)
- resolutionGain = clamp((optimizedFairness - currentFairness) * 18 + (currentCv - improvedCv) * 12, 0, 15)
- fcrGain = clamp((optimizedFairness - currentFairness) * 9 + (currentCv - improvedCv) * 4, 0, 8)

Output as one-decimal percentages.

## Master Recommendation Summary Mapping
For each recommendation rec in workloadBalanceRecommendations:

1. Base values
- currentLoad = Number(rec.current_load ?? 0)
- adjustment = Number(rec.adjustment ?? 0)

2. Redirect percentage
- redirectPct = currentLoad > 0 ? round(abs(adjustment) / currentLoad * 100) : 0

3. Flag classification
- Overloaded if adjustment > 1
- Underloaded if adjustment < -1
- Balanced otherwise

4. Expected gains
- expectedSla = "+" + predictedKpiImprovements.sla_compliance_gain_pct + "%"
- expectedFcr = "+" + predictedKpiImprovements.fcr_rate_gain_pct + "%"

5. Suggested team resolution order
- Try rec.assignment_group_id when it exists and is different from selectedGroupId
- If still empty and flag is Overloaded, use first acceptingGroupsForOffload team
- Fallback to selectedGroup.group_name
- Final fallback: Current Group

6. Row output
- user_id
- flag
- redirectPct
- suggestedTeam
- expectedSla
- expectedFcr

## Rendering Behavior
The section should render only when summary rows are available.

Recommended UI behavior:
1. Title: Master recommendation summary
2. Subtitle: Actionable flags and expected SLA/FCR impact if the recommended redistribution plan is followed.
3. Table columns:
- Flag
- % Redirect
- Suggested Team
- Expected SLA Gain
- Expected FCR Gain

Empty state behavior:
- If no rows, show a compact info message that no redistribution recommendations are currently required.

## Important Product Constraints
Current logic intentionally limits this summary to Service Desk context:
- isServiceDeskGroup must be true

If broader coverage is required across all groups, remove that gate or make it configurable.

## Rebuild Checklist After Reset
1. Recreate predictedKpiImprovements useMemo
2. Recreate workloadBalanceRecommendations useMemo with gating rules
3. Recreate workloadRecommendationSummary useMemo mapping exactly as documented
4. Recreate UI card/table for the summary
5. Verify backend and ML payloads include required recommendation fields

## QA Checklist
1. Overloaded rows show high redirect percentages and non-empty suggested teams
2. Expected SLA/FCR gains display with percentage formatting
3. Empty state appears when recommendations are unavailable
4. Service Desk gate behavior matches intended product scope
5. No runtime errors when recommendation arrays are missing or partial

## Backend and ML Contract Notes
To preserve stable frontend behavior, recommendation rows should include at minimum:
- user_id
- current_load
- adjustment
- assignment_group_id (optional but recommended)

Predicted improvements should include:
- sla_compliance_gain_pct
- fcr_rate_gain_pct
- avg_resolution_time_reduction_pct (optional for summary table)

If predicted improvements are absent, frontend fallback formulas above should be used.

## Implementation Template (Pseudo-code)
Use this as a direct recreation skeleton in ManagerDashboard logic:

```ts
const predictedKpiImprovements = useMemo(() => {
  if (!effectiveWorkloadBalance) return null;

  if (effectiveWorkloadBalance.predicted_improvements) {
    return effectiveWorkloadBalance.predicted_improvements;
  }

  const currentFairness =
    effectiveWorkloadBalance.current_analysis?.fairness_score ??
    workloadAnalysis?.analysis?.fairness_score ??
    0;
  const optimizedFairness =
    effectiveWorkloadBalance.optimized_analysis?.fairness_score ??
    Math.min(1, currentFairness + 0.08);
  const currentCv =
    effectiveWorkloadBalance.current_analysis?.coefficient_of_variation ??
    workloadAnalysis?.analysis?.coefficient_of_variation ??
    0.2;
  const improvedCv = Math.max(0, currentCv - 0.05);

  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

  return {
    sla_compliance_gain_pct: Number(
      clamp((optimizedFairness - currentFairness) * 20 + (currentCv - improvedCv) * 10, 0, 10).toFixed(1)
    ),
    resolution_time_improvement_pct: Number(
      clamp((optimizedFairness - currentFairness) * 18 + (currentCv - improvedCv) * 12, 0, 15).toFixed(1)
    ),
    fcr_rate_gain_pct: Number(
      clamp((optimizedFairness - currentFairness) * 9 + (currentCv - improvedCv) * 4, 0, 8).toFixed(1)
    ),
  };
}, [effectiveWorkloadBalance, workloadAnalysis]);

const workloadBalanceRecommendations = useMemo(() => {
  if (!effectiveWorkloadBalance || !isGroupImbalanced || !isServiceDeskGroup) {
    return [];
  }
  return effectiveWorkloadBalance.recommendations ?? [];
}, [effectiveWorkloadBalance, isGroupImbalanced, isServiceDeskGroup]);

const workloadRecommendationSummary = useMemo(() => {
  if (!workloadBalanceRecommendations.length || !predictedKpiImprovements) {
    return [];
  }

  return workloadBalanceRecommendations.map((rec) => {
    const currentLoad = Number(rec.current_load ?? 0);
    const adjustment = Number(rec.adjustment ?? 0);
    const redirectPct = currentLoad > 0
      ? Math.round((Math.abs(adjustment) / currentLoad) * 100)
      : 0;

    let flag: "Overloaded" | "Underloaded" | "Balanced" = "Balanced";
    if (adjustment > 1) flag = "Overloaded";
    else if (adjustment < -1) flag = "Underloaded";

    const suggestedTeam =
      (rec.assignment_group_id && rec.assignment_group_id !== selectedGroupId
        ? assignmentGroups.find((g) => g.group_id === rec.assignment_group_id)?.group_name
        : undefined) ||
      (flag === "Overloaded" ? acceptingGroupsForOffload[0]?.group_name : undefined) ||
      selectedGroup?.group_name ||
      "Current Group";

    return {
      user_id: rec.user_id,
      flag,
      redirectPct,
      suggestedTeam,
      expectedSla: `+${predictedKpiImprovements.sla_compliance_gain_pct}%`,
      expectedFcr: `+${predictedKpiImprovements.fcr_rate_gain_pct}%`,
    };
  });
}, [
  workloadBalanceRecommendations,
  predictedKpiImprovements,
  selectedGroupId,
  assignmentGroups,
  acceptingGroupsForOffload,
  selectedGroup,
]);
```
