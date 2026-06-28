# Strategic Actions Policy Sheet

Version: 1.0
Last updated: 2026-06-24
Owner: HR Analytics / ML Service

## Purpose
This sheet defines exactly when the system recommends:
- Hire
- Temporary staffing / reassign
- Training
- Retain and monitor

It is intended for business sign-off, audit traceability, and safe threshold tuning.

## Decision Pipeline
The final recommendation is produced in this order:
1. Compute team features from ticket data.
2. Build a rule-based policy label (business gate).
3. Train and predict with decision tree model.
4. Apply confidence guardrails and business gate override.
5. Return final action, priority, and KPI deltas.

If only one action class exists in the current cohort, the system uses deterministic policy output directly.

## Input Features Used
Core features used for action selection:
- capacityGap
- loadRatio
- slaCompliance
- fcrRate
- avgResolutionTime
- fairnessScore
- currentLoad
- recommendedLoad
- groupGrowthRate

### Frontend normalization used before sending to ML
- Monthly per-agent target capacity: 205 tickets/month (midpoint of 190-220)
- loadRatio = currentLoadPerAgent / 205
- capacityGap = max(recommendedStaff - currentStaff, 0)
- groupGrowthRate based on recent 21-day window vs prior 21-day window

## Current Business Thresholds

### Hire thresholds
- growth_rate >= 15.0
- load_ratio >= 1.18
- capacity_gap >= 2.0
- quality pressure required:
  - SLA < 88.0 OR
  - FCR < 72.0 OR
  - avg_resolution_time > 1.8

### Temporary staffing / reassign thresholds
- (1.06 <= load_ratio < 1.18) OR (8.0 <= growth_rate < 15.0)
- SLA >= 88.0
- FCR >= 72.0

### Training thresholds
Triggered when either condition is true:
1. Severe quality pressure:
  - SLA < 84.0 OR
  - FCR < 52.0 OR
  - avg_resolution_time > 3.6
2. Quality pressure plus workload pressure:
   - Quality pressure:
     - SLA < 90.0 OR
     - FCR < 75.0 OR
     - avg_resolution_time > 1.8
   - Workload pressure:
     - load_ratio >= 1.10 OR
     - growth_rate >= 10.0 OR
     - capacity_gap >= 2.0

### Retain and monitor
- Default action when none of the above trigger conditions are met.

## Decision Priority Order
Policy check order is strict:
1. Hire
2. Temporary staffing / reassign
3. Training
4. Retain and monitor

This means the first matching condition in this sequence is selected.

## Model Configuration
Model type:
- DecisionTreeClassifier

Current parameters:
- max_depth = 4
- min_samples_leaf = 14
- min_samples_split = 30
- class_weight = balanced
- random_state = 42

Training behavior:
- 20 jittered augmentations per sample batch for stability.
- Test split is 20% only when enough samples are present.

## Confidence and Safety Guardrails
- Minimum confidence for any model action: 0.55
- Minimum confidence for Hire: 0.70
- If model confidence is below minimum:
  - fallback to Retain and monitor
- If model predicts Hire but rule gate does not allow Hire:
  - Hire is blocked
- If rule gate is Hire but model predicts non-Hire:
  - non-Hire is blocked

## Priority Labels in Output
- Hire -> High
- Temporary staffing / reassign -> Medium
- Training -> High only when BOTH are true:
  - Severe quality pressure:
    - SLA < 82.0 OR
    - FCR < 50.0 OR
    - avg_resolution_time > 4.5
  - Severe workload pressure:
    - load_ratio >= 1.18 OR
    - growth_rate >= 15.0 OR
    - capacity_gap >= 2.0
  Otherwise Training -> Medium
- Retain and monitor -> Low

## KPI Impact Output Policy
Each action returns KPI deltas for:
- SLA (points)
- FCR (points)
- Resolution time (hours)

These are stress-scaled and bounded for readability:
- SLA delta bounded to [0.05, 4.00]
- FCR delta bounded to [0.05, 4.00]
- Resolution delta bounded to [-0.90, -0.02]

## Governance Notes
- This policy is conservative against false-positive hiring.
- Low-load, low-gap teams should trend toward Retain and monitor.
- Training should not trigger on quality dips alone unless severity is high or workload pressure also exists.

## Change Control Template
When changing thresholds, capture:
1. Reason for change
2. Previous value and new value
3. Expected behavioral impact
4. Validation dataset and outcomes
5. Approval owner and date
