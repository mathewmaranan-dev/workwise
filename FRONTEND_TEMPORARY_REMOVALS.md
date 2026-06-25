# Frontend Temporary Removals (Restore Later)

This file tracks frontend-only features intentionally hidden/removed and can be used as a restoration checklist.

## 1) HR Dashboard: Employee Satisfaction card hidden
- File: `frontend/src/app/pages/dashboards/HRDashboard.tsx`
- What was removed:
  - KPI card titled `Employee Satisfaction`
  - UI rendering of `employeeSatisfaction.toFixed(1)/5.0`
- Data/backend status:
  - Backend logic remains untouched.
  - Frontend utility function still exists in analytics and can be re-imported.
- How to restore:
  1. Re-import `calculateEmployeeSatisfaction`.
  2. Recreate `const employeeSatisfaction = calculateEmployeeSatisfaction(currentTickets);`.
  3. Reinsert the KPI card block.

## 2) HR Dashboard: Productivity Trend card hidden
- File: `frontend/src/app/pages/dashboards/HRDashboard.tsx`
- What was removed:
  - KPI card titled `Productivity Trend`
  - UI rendering of trend value and conditional icon/color styling
- Data/backend status:
  - Backend logic remains untouched.
  - Frontend utility function still exists in analytics and can be re-imported.
- How to restore:
  1. Re-import `calculateProductivityTrend` and `TrendingUp` icon.
  2. Recreate `const productivityTrend = calculateProductivityTrend(currentTickets);`.
  3. Reinsert the Productivity Trend KPI card block.

## 3) Login: Forgot password link hidden
- File: `frontend/src/app/pages/LoginPage.tsx`
- What was removed:
  - Visible `Forgot password?` link from login form
- Data/backend status:
  - Forgot/reset routes and backend functionality are preserved.
- How to restore:
  1. Re-add the `Link` element to `/forgot-password` in the login action row.
  2. Restore layout to `justify-between` if desired.

## 4) Manager Dashboard: Team staffing gap analysis card hidden
- File: `frontend/src/app/pages/dashboards/ManagerDashboard.tsx`
- What was removed:
  - Card section titled `Team staffing gap analysis`
  - Related memoized frontend-only summary block for that card
- Data/backend status:
  - Backend APIs remain available.
- How to restore:
  1. Re-add the `teamStaffingAnalysis` memo block.
  2. Reinsert the table/card rendering section in the Manager dashboard.

## 5) HR Dashboard: Teams Requiring Immediate Attention section hidden
- File: `frontend/src/app/pages/dashboards/HRDashboard.tsx`
- What was removed:
  - Full alert section titled `Teams Requiring Immediate Attention`
  - Per-team detailed cards shown for underperforming groups
- Data/backend status:
  - Backend logic remains untouched.
  - `underperformers` computation still exists for KPI count usage.
- How to restore:
  1. Reinsert the conditional alert card block that renders underperforming teams.
  2. Re-add `TrendingDown` icon import if needed.

## 6) HR Dashboard: Agent-Level Load Summary section hidden
- File: `frontend/src/app/pages/dashboards/HRDashboard.tsx`
- What was removed:
  - Full table section titled `Agent-Level Load Summary`
  - Supporting frontend-only `agentSummary` computed list used by that table
- Data/backend status:
  - Backend logic remains untouched.
  - Removal is frontend-only and reversible.
- How to restore:
  1. Re-add the `agentSummary` computation in `recommendationData`.
  2. Re-add `agentSummary` to the returned object/destructuring.
  3. Reinsert the `Agent-Level Load Summary` card/table block.

## Notes
- This checklist tracks frontend visibility changes only.
- Backend services and endpoints were intentionally kept intact for future re-enable.
