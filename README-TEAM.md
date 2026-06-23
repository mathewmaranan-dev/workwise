# Team Workflow and Dashboard Objectives

## Purpose
This document describes the shared workflow, ownership, and dashboard objectives for the current project. It is designed to keep development aligned when multiple people are working in parallel and to reduce logic conflicts.

## Objectives

### Admin Dashboard
- Validate the logic and behavior for **Median Resolution Time**.
- Fix the **Reopen Rate** logical error.
- Ensure **Weekly Ticket Volume** prediction extends beyond the current date.
- If **Non-FCR Ticket** is still used, make it follow the same summary logic as the **Non-FCR Risk Summary** and remove any separate drilldown logic.

### Manager Dashboard
- Verify the logic and behavior of the statistics cards.
- Ensure **Non-FCR Alerts** count only flagged tickets for the manager's assignment group.
- Change workload calculations to be based on the **monthly ticket rate**, not the raw total ticket count.

### HR Dashboard
- Remove **Employee Satisfaction** entirely from the dashboard.
- Verify the logic and behavior of the statistics cards.
- Add an organizational workload trend that includes prediction for coming months.
- Review **Top Performing Teams** logic and ensure it is based on real monthly rates and relevant KPI performance.
- Reset the rules for **Recommended Strategic Actions** so they reflect monthly agent workload, not total ticket count.
  - Use a baseline of about **204 tickets per agent per month** when estimating workload.
- Only recommend hires when there is both:
  - a predicted continued spike in ticket workload, and
  - KPI performance is deteriorating at a substantial rate.

## Team Ownership
- **Person 1:** Shared analytics helper owner
  - Own `frontend/src/app/utils/analytics.ts`
  - Implement shared metric and trend helpers
  - Ensure calculations are centralized and reusable
- **Person 2:** Admin dashboard owner
  - Own `frontend/src/app/pages/dashboards/AdminDashboard.tsx`
  - Wire admin UI to shared helpers
  - Fix admin-specific metric behavior
- **Person 3:** Manager dashboard owner
  - Own `frontend/src/app/pages/dashboards/ManagerDashboard.tsx`
  - Apply group-specific metric logic and workload rules
- **Verifier:** Final reviewer
  - Review and integrate dashboard changes
  - Confirm helpers and dashboards align

## Shared Rules
- Use `analytics.ts` as the single source of truth for KPI logic.
- Avoid duplicate business logic inside dashboard components.
- Keep dashboard files responsible only for rendering and data wiring.
- Keep helper files responsible only for computation and data transformation.
- Agree on helper names before changing their signatures.
- Use comments in helpers to document expected input/output shapes and units.

## Recommended Helper API
Use the following shared helpers whenever possible:
- `normalizeTicket(ticket)`
- `calculateKPIs(ticketData)`
- `getWeeklyTicketSeries(ticketData, options)`
- `getMonthlyTicketRate(ticketData)`
- `getNonFCRTickets(ticketData)`
- `getGroupAssignmentMetrics(ticketData, groupId)`
- `getWorkloadRecommendations(ticketData, options)`

## Branching Strategy
Use these branches for parallel development:
- `feature/dashboard-analytics-helpers`
- `feature/admin-dashboard-kpis`
- `feature/manager-dashboard-workload`
- `feature/hr-dashboard-strategy`

## Commit Guidelines
- Keep commits small and purpose-driven.
- Include a short description and the team role in the PR.
- Example commit message: `fix(admin): calculate reopen rate from real ticket history`
- Add a PR note like: `I am person 1 — analytics helper work`

## Review Checklist
Each PR should answer:
- Does this change use shared helpers instead of duplicating logic?
- Does it keep UI rendering separate from metric calculations?
- Does it use monthly workload rate where required?
- Does it fix the requested dashboard objective?
- Does it include a responsibility note like `I am person X`?

## Team Communication
- If you change helper signatures, alert the team immediately.
- If a dashboard needs a helper that does not exist, request it from Person 1.
- Use small PRs to reduce merge conflicts.
- Do not merge dashboard work until the helper logic is stable.

## Notes
- Monthly workload is the key unit for Manager and HR dashboards.
- Use roughly **204 tickets per agent per month** as a workload baseline, not total tickets.
- Hiring should only be recommended on sustained spike + KPI decline.
