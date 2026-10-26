# Work-Wise

**A machine-learning decision support system that tells IT service desk managers what is coming, what is going wrong, and who to hire.**

![Status](https://img.shields.io/badge/status-capstone%20prototype-blue)
![Python](https://img.shields.io/badge/ML-Python%20%7C%20scikit--learn-3776AB)
![Backend](https://img.shields.io/badge/backend-PHP%20%7C%20CodeIgniter-777BB4)
![Method](https://img.shields.io/badge/method-Agile--Scrum-green)

Work-Wise turns raw IT ticket data into three kinds of insight in one web dashboard: **forecasts** of ticket volume, **diagnoses** of why tickets are not resolved on the first call, and **prescriptions** for staffing and interventions. It was built as a capstone for a Cognizant ITSM Service Desk Manager and evaluated by 30 respondents.

> Built at FEU Alabang (BS Information Technology, Business Analytics) and presented at IGNITE 2026. This is an academic prototype made for a Cognizant employee, not an official Cognizant product.

<!-- Add a hero screenshot or short GIF of the dashboard here:
![Work-Wise dashboard](docs/screenshots/dashboard.png) -->

---

## At a glance

| | |
|---|---|
| **Problem** | Service desks juggle SLAs, first-call resolution (FCR) and workload balance with standalone tools and manager intuition, so surges, repeat tickets and understaffing are spotted late. |
| **Solution** | One platform that predicts demand, flags at-risk tickets, and recommends staffing and actions, with a separate view for each role. |
| **Result** | Rated **Agree** overall by 20 stakeholders (**3.90 / 5**) and 10 technical evaluators (**3.92 / 5**). No respondent disagreed with any statement. |
| **Honest scope** | Tested on simulated data with manual CSV upload. Evidence is user perception, not measured operational change (see [Limitations](#limitations)). |

---

## What it does

| Layer | Question it answers | How |
|---|---|---|
| **Predict** | How many tickets are coming, and when is the surge? | Time-series forecast (ARIMA/SARIMA) of weekly ticket volume, shown as actual vs. predicted. |
| **Diagnose** | Why are tickets not solved on the first call? | Logistic regression on ticket category and assigned agent. Each ticket gets a risk score. Pairing category and agent separates systemic problems from individual ones. |
| **Prescribe** | What should we do about it? | Suggested actions per risk (monitor, standard handling, training, reassignment, escalation) and current vs. recommended staffing per team, with hiring priorities. |

Also included: KPI monitoring (SLA compliance, FCR rate, median resolution time, reopen rate), assignment-group comparison, workload-imbalance detection and scenario simulation for staffing.

### One system, four views

| Role | What they see |
|---|---|
| **Admin** | Overall ITSM health, ticket trends, user management, data upload, any team's dashboard |
| **ITSM Team Manager** | Team SLA and FCR, active tickets, flagged tickets, problem areas, staffing needs |
| **HR and Senior Management** | Organization-wide performance, workload trends, teams needing support, forecasts |
| **IT Support Agent** | Own open tasks, resolved tickets, high-priority items, personal metrics |

<!-- Add one screenshot per feature, for example:
![Forecast](docs/screenshots/forecast.png)
![Non-FCR risk](docs/screenshots/non-fcr.png)
![Staffing gaps](docs/screenshots/staffing.png) -->

---


### Models

| Model | Inputs | Evaluation design |
|---|---|---|
| Non-FCR detector (logistic regression) | Ticket category, assigned employee, FCR status | 70/30 stratified split; precision, recall, F1, ROC-AUC |
| Ticket forecast (ARIMA / SARIMA) | Historical ticket trends, staffing levels, SLA compliance | 70/30 split; MAE, RMSE |
| Staffing model (regression + simulation) | Forecast volume, agent-to-ticket ratios, SLA threshold | Sufficiency checked with precision, recall, F1 |

<!-- Add measured results here once finalized:
| Model | Metric | Value |
|---|---|---|
| Forecast | MAE / RMSE | |
| Non-FCR detector | Precision / Recall / F1 / ROC-AUC | | -->

---

## Impact and business implications

**Decisions it changes**

- **Service desk managers** rebalance work before SLAs slip and target training or reassignment with data instead of impressions.
- **HR and talent teams** justify hiring with forecast volume versus capacity.
- **Senior leaders** see where performance and workload problems sit across teams.
- **Agents** get visibility into their own load and metrics.

**Why it matters commercially**

- Non-FCR tickets raise cost, lengthen resolution and lower caller satisfaction. Finding their drivers early targets the expensive part of the queue.
- Headcount decisions are made on forecast demand, not guesswork, which matters most in high-volume support and BPO operations where KPIs and SLAs drive client contracts.
- It is explainable: FCR is visible by category and agent, flagged tickets are traceable, and every recommendation is advisory, so managers stay in control.
- Implementation cost was low: about PHP 8,962 for hosting and a domain. The system was donated to the client.

**What users said** (5-point Likert, FURPS model, Cronbach's alpha above 0.70)

| Dimension | Stakeholders (n=20) | Technical evaluators (n=10) |
|---|---|---|
| Effectiveness and performance | 3.90 | 3.84 |
| Usability and reliability | 4.06 | 3.90 |
| Overall impact / supportability | 3.73 | 4.17 |
| Functionality and analytical capability | not asked | 3.76 |
| **Overall** | **3.90** | **3.92** |

Highest-rated items: practical for real-world ITSM operations (4.30), would recommend further development (4.20), API and integration points (4.10), business value beyond basic ITSM reporting (4.10).

---

## Skills demonstrated

| Area | Evidence in this project |
|---|---|
| **Machine learning** | Time-series forecasting, binary classification with probability scoring, regression, scenario simulation, train/test design |
| **Data and analytics** | Feature engineering from ticket data, KPI design (SLA, FCR, resolution time, reopen rate), normalized ERD with audit table |
| **Full-stack development** | PHP/CodeIgniter backend, Python ML services, Chart.js dashboards, role-based access control, CSV validation |
| **Product thinking** | Role-specific dashboards, explainable outputs, advisory (human-in-the-loop) design |
| **Research and statistics** | FURPS evaluation, purposive sampling, weighted means, Cronbach's alpha |
| **Delivery** | Agile-Scrum sprints with client feedback, functional and role-based test cases, documentation |
| **Stakeholder work** | Requirements gathered from a working service desk manager; presented to industry and academic panels |

---

## Tech stack

Python (NumPy, Pandas, scikit-learn) · PHP / CodeIgniter · HTML, CSS, JavaScript · Bootstrap / Tailwind · Chart.js · PostgreSQL · Render (hosting) · Figma (design) · Git / GitHub

---

## Data format

Tickets are loaded by CSV. Required columns: `Ticket Number`, `Priority`, `Category`, `FCR`, `Created`, `Status`, `Made SLA`. Optional fields enable deeper analysis. Uploads missing a required column are rejected with a validation error.

<!-- ## Run locally
Add setup steps here: prerequisites, environment variables, database setup, how to start the app, and where to find sample data. -->

---

## Limitations

- Built and tested on **simulated data** generated from sample fields the client could provide. No live ticket feed.
- Data enters by **periodic manual upload**, so there is no real-time streaming.
- Forecast and diagnostic quality depends on the completeness of uploaded data.
- Evaluation measured **perceived value**. Technical evaluators were neutral on measurable SLA and efficiency improvement, which is the key thing a live pilot would test.
- Scoped to one team unless adopted more widely.

## Roadmap

1. Real-time data streaming from the ticketing system
2. Pilot on live data to measure SLA, FCR and efficiency change
3. Automated data validation and cleansing pipelines
4. Continuous model monitoring, retraining and drift detection
5. Validation in larger, more varied ITSM environments

---

## Team

**Quatro**: Jorge Jesse Jr. M. Cabinian · Matthew Nicolai D. Competente · Jacob Riley D. Fernandez · Mathew G. Maranan

Capstone Adviser: Milagros V. Ortega, MIT · Course Adviser: Armando D. Del Mundo, PhD
FEU Alabang, BS Information Technology with Specialization in Business Analytics, 2026

## Citation

> Cabinian, Competente, Fernandez & Maranan (2026). *Work-Wise: An Intelligent Multi-Level Decision Support System Using Machine Learning Forecasting, Performance Diagnostics, and Workload Optimization for ITSM Operations.* FEU Alabang.
