# WorkWise System Demo Script

Version: 1.0
Audience: stakeholders, operations leads, HR, support managers
Flow order: Admin -> Manager -> HR -> Agent

## 1. Demo Goal and Scope
Use this script to demonstrate:
- What each dashboard does
- Which metrics are computed and how
- Which ML model powers each feature
- Which input parameters control behavior
- How staffing and recommendation decisions are produced

## 2. Pre-Demo Checklist
1. Confirm backend is running and connected to DB.
2. Confirm frontend is running.
3. Confirm ML service is running.
4. Log in as Admin first.
5. Ensure ticket data is loaded in DB (or uploaded dataset fallback available).
6. Optional: keep one SQL panel open to verify user counts per assignment group.

## 3. Architecture Snapshot (Use in opening)
Say:
"WorkWise uses a React frontend, Node/Express backend proxy and KPI APIs, and a Python ML service. Dashboards share ticket analytics and then call specialized ML endpoints for forecasting, non-FCR risk, workload balancing, and strategic staffing actions."

Core API surfaces:
- `/api/kpis/dashboard`
- `/api/kpis/dashboard/tickets`
- `/api/kpis/staffing/group-counts`
- `/api/ml/forecast/tickets`
- `/api/ml/fcr/predict`
- `/api/ml/workload/*`
- `/api/ml/hr/strategic-actions`

## 4. Admin Dashboard Script

### 4.1 Entry and Intent
Action:
- Open Admin tab.

Say:
"Admin dashboard is the system-wide control tower. It shows core service KPIs, forecasted ticket volume, and assignment group performance."

### 4.2 KPI Cards
What to show:
- SLA Compliance
- FCR Rate
- Median Resolution Time
- Reopen Rate

Calculations:
- SLA compliance: `sla_met / total_tickets * 100`
- FCR rate: `fcr_true / total_tickets * 100`
- Median resolution time: median of resolved ticket durations in hours
- Reopen rate: `reopened_tickets / total_tickets * 100`

Primary sources:
- Backend KPI endpoint returns aggregate metrics
- Frontend fallback uses analytics utilities if backend metrics unavailable

### 4.3 Weekly Ticket Volume (Actual vs Forecast)
What to show:
- Blue line: actual weekly volume
- Green dashed line: ML forecast

Backend endpoint and parameters:
- Endpoint: `POST /api/ml/forecast/tickets`
- Parameter: `days_ahead` (Admin uses 56 days)
- Optional parameter: `assignment_group_id` (omit for org-wide)

Processing logic:
- Forecast returns daily predictions
- Frontend aggregates daily forecast into weekly points
- Weekly series combines historical weeks + projected weeks

Model used:
- TicketForecast pipeline (time-series)
- Candidate models: SARIMA, then ETS fallback, then ARIMA fallback
- Forecast path stabilization is applied to prevent unrealistic spikes

Forecast quality outputs now available:
- `rmse`
- `mae`
- `mape`
- `confidence`
- `holdout_days`

### 4.4 Tickets by Priority and Assignment Group Performance
What to show:
- Priority distribution pie
- Group SLA/FCR bar chart

Calculations:
- Priority chart: count by `priority_id`
- Group performance:
  - SLA: `group_sla_met / group_total * 100`
  - FCR: `group_fcr_count / group_total * 100`

## 5. Manager Dashboard Script

### 5.1 Entry and Intent
Action:
- Switch to Manager tab.
- Select a target assignment group if logged in as admin.

Say:
"Manager dashboard focuses on one team, combining operational KPIs with prescriptive actions: non-FCR detection, balancing, and staffing what-if analysis."

### 5.2 Team KPI and Task Allocation
What to show:
- Team SLA, team FCR, active tickets, non-FCR alerts
- Task allocation by status

Calculations:
- Team metrics are computed from team-filtered ticket set
- Active tickets generally exclude resolved/closed statuses

### 5.3 Non-FCR Risk and Category-Agent Risk Rows
What to show:
- Non-FCR Risk Summary table
- Non-FCR Detection List

Model used:
- `FCRPredictor` (trained model if available, heuristic fallback)

Main prediction inputs (per ticket):
- `assignment_group_id`
- `assigned_to_id`
- `category_id`
- `priority_id`
- `impact_id`
- `urgency_id`
- `reopen_count`
- `reassignment_count`
- `duration`
- `ticket_complexity`
- `agent_fcr_history`
- `category_non_fcr_rate`

Category-agent rule logic in risk summary rows:
- If category FCR < 40% and agent FCR = 0%: Dual Alert
- Else if category FCR < 40%: Systemic Category Issue
- Else if agent category FCR < category FCR - 20 points: Agent Skill Gap
- Else: No Risk

### 5.4 Workload Optimization and Staffing Guidance
What to show:
- Team staffing gap analysis table
- Forecast vs actual workload chart
- Master recommendation summary

Model used:
- `WorkloadOptimizer`

Workload optimizer key parameters:
- `fairness_threshold` default: 0.25
- `max_workload_ratio` default: 1.5

Workload optimization logic:
- Computes current load statistics (mean, std dev, imbalance ratio, fairness score)
- Uses performance-weighted allocation (`0.6 * SLA + 0.4 * FCR`, adjusted by experience)
- Recommends ticket reassignment under fairness constraints

Staffing prediction inputs:
- `forecast_volume[]`
- `current_team_size`
- `avg_capacity`

Outputs:
- recommended team size
- staffing change
- utilization at recommended staffing

## 6. HR Dashboard Script

### 6.1 Entry and Intent
Action:
- Switch to HR tab.

Say:
"HR dashboard is the strategic workforce planning layer: organization trend forecast, staffing gaps, fairness, and ML strategic actions."

### 6.2 Organizational KPI and Trend Layer
What to show:
- Overall performance
- Employee satisfaction
- Productivity trend
- Teams needing support
- Organizational workload trend (monthly actual + monthly forecast)

Calculations:
- Overall performance: `(SLA + FCR) / 2`
- Employee satisfaction: `((SLA * 0.6 + FCR * 0.4) / 100) * 5`
- Productivity trend: compares current 2-week ticket count vs previous 2-week period

Trend model and logic:
- Uses same ML forecast endpoint as Admin
- Forecast horizon used in HR: `days_ahead = 180`
- Weekly historical/forecast is aggregated to monthly points for planning view

### 6.3 Team Staffing Gap Planning
What to show:
- Current staff vs recommended staff chart
- Gap/priority table

Current staff source (DB-backed):
- Endpoint: `GET /api/kpis/staffing/group-counts`
- Source of truth: users table grouped by assignment group

Monthly workload normalization:
- Monthly target per agent = midpoint of 190-220 -> 205
- Group monthly rate derived from ticket dates

Hire recommendation gate (minimum necessary staffing):
- Triggered when all are true:
  - load ratio >= 1.18
  - projected capacity gap >= 2
  - quality pressure (SLA < 88 OR FCR < 72 OR avg resolution > 1.8)
- Recommended staff is minimum required to meet load target when gate is met
- Otherwise recommended staff remains current staff

### 6.4 Group Capacity and Fairness Summary
What to show:
- Current load
- Recommended load
- Gap
- Fairness score
- Decision

Calculations:
- `currentLoadPerAgent = groupMonthlyRate / currentStaff`
- `loadRatio = currentLoadPerAgent / 205`
- `fairnessScore = clamp(100 - abs(loadRatio - 1) * 40, 0, 100)`
- `capacityGap = max(recommendedStaff - currentStaff, 0)`

### 6.5 Strategic Actions (Decision Tree + Policy Gate)
What to show:
- Prioritized actions by assignment group
- KPI deltas for If followed / If not followed
- Computed From panel

Model used:
- `StrategicActionsModel` (decision tree with policy gate)

Input features:
- capacityGap, loadRatio, slaCompliance, fcrRate, avgResolutionTime
- fairnessScore, currentLoad, recommendedLoad, groupGrowthRate

Core business thresholds (examples):
- Hire: high growth/load/capacity gap plus quality pressure
- Temporary staffing: moderate load/growth band with acceptable SLA/FCR
- Training: severe quality pressure, or quality pressure + workload pressure
- Retain & monitor: default when triggers not met

Guardrails:
- confidence floor for actions
- stricter confidence for Hire
- policy gate can override model action

## 7. Agent Dashboard Script

### 7.1 Entry and Intent
Action:
- Switch to Agent tab.
- If enabled, select an agent from selector.

Say:
"Agent dashboard operationalizes work at the individual level: queue visibility, urgency, personal throughput, and ticket-level filters."

### 7.2 Agent KPI Cards
What to show:
- Open tasks
- Resolved today
- High priority open tasks
- Average resolution time

Calculations:
- Open tasks: assigned tickets not resolved/closed
- Resolved today: resolved/closed tickets with today date
- High priority: priority in Critical or High
- Avg resolution: average ticket duration over tickets with duration values, converted to hours

### 7.3 Workload and Category Views
What to show:
- Workload by priority bar chart
- Ticket category distribution pie chart

Calculations:
- Group counts by normalized ticket priority/category labels

### 7.4 All My Tasks Table with Filters
What to show:
- Priority filter
- Category filter
- Task list fields (ticket id, priority, category, status, opened date)

Behavior:
- Agent matching is by assigned ID and robust name/email fallback matching

## 8. Model-to-Feature Mapping (Quick Reference)
- Ticket forecasting (Admin + HR trends, Manager forecast line):
  - Service: `TicketForecast`
  - Endpoint: `/api/ml/forecast/tickets`
- Non-FCR risk (Manager):
  - Service: `FCRPredictor`
  - Endpoint: `/api/ml/fcr/predict`
- Workload balancing and staffing suggestion (Manager):
  - Service: `WorkloadOptimizer`
  - Endpoints: `/api/ml/workload/balance`, `/api/ml/workload/staffing`, `/api/ml/workload/analyze`
- Strategic staffing actions (HR):
  - Service: `StrategicActionsModel`
  - Endpoint: `/api/ml/hr/strategic-actions`
- Diagnostics suite (Manager and support tooling):
  - Service: `PerformanceDiagnostics`
  - Endpoints: `/api/ml/diagnostics/*`, `/api/ml/anomalies/detect`

## 9. Suggested Demo Narrative (Time-Boxed)
1. Admin (4-5 min): show enterprise health + forecast confidence and error metrics.
2. Manager (6-8 min): show team bottlenecks, non-FCR risk, balancing recommendations.
3. HR (6-8 min): show monthly workforce trend, staffing gap logic, strategic actions and KPI deltas.
4. Agent (3-4 min): show execution layer and filtered task operations.
5. Q&A (3-5 min): explain parameter tunability and governance thresholds.

## 10. Common Q&A Answers
Q: Where do staff counts come from?
A: From DB users table grouped by assignment group via `/api/kpis/staffing/group-counts`.

Q: Are recommendations rule-based or ML?
A: Both. ML proposes scores/actions and business gates enforce policy-safe decisions.

Q: How do we trust forecast quality?
A: Forecast now exposes holdout error metrics: RMSE, MAE, MAPE, plus confidence and holdout window length.

Q: What happens if ML is unavailable?
A: Each dashboard has fallback behavior (historical-only trend, heuristic/non-ML paths, or safe defaults).

## 11. Closing Statement
"This platform is not just descriptive analytics; it is prescriptive and operational. It links service KPIs, forecasting, and workforce decisions with explicit formulas, transparent model outputs, and policy guardrails."
