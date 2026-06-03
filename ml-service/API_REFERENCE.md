# ML Module API Reference

## Base URL
```
http://localhost:5000/api/ml
```

## Authentication
Currently open (can add bearer token auth later)

## Response Format
All responses are JSON with standard structure:
```json
{
  "data": {...},
  "error": null,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

## Endpoints

### 1. FCR Risk Prediction

#### Predict Single Ticket
```
POST /fcr/predict
```

**Description:** Predict First-Contact Resolution risk for a single ticket

**Request Body:**
```json
{
  "ticket_id": "TICK-001",
  "priority_id": 3,
  "category": "software",
  "duration": 120,
  "reopen_count": 0,
  "reassignment_count": 0,
  "agent_fcr_history": 0.75,
  "category_non_fcr_rate": 0.20,
  "ticket_complexity": 6
}
```

**Response (200 OK):**
```json
{
  "risk_score": 0.45,
  "risk_level": "medium",
  "confidence": 0.72,
  "model_type": "trained_model",
  "threshold": 0.5,
  "drivers": [
    {
      "type": "complexity",
      "factor": "Priority 3",
      "impact": "medium",
      "contribution_to_risk": 0.24,
      "explanation": "Higher priority tickets tend to be more complex..."
    },
    {
      "type": "category",
      "factor": "software category",
      "impact": "low",
      "contribution_to_risk": 0.04,
      "explanation": "Software category has slightly higher non-FCR rate..."
    }
  ],
  "recommendations": [
    "Route to experienced agent or team",
    "Consider knowledge base consultation",
    "Monitor ticket for quality issues"
  ],
  "intervention_required": true,
  "priority_actions": [
    "Recommended: Assign to experienced team member",
    "Recommended: Provide knowledge base resources"
  ]
}
```

**Response (500 Error):**
```json
{
  "error": "Error message here",
  "risk_score": 0.5,
  "risk_level": "medium",
  "confidence": 0.5
}
```

---

#### Batch Predict
```
POST /fcr/batch-predict
```

**Description:** Predict FCR risk for multiple tickets at once

**Request Body:**
```json
{
  "tickets": [
    {
      "ticket_id": "TICK-001",
      "priority_id": 3,
      "category": "software",
      "duration": 120,
      "reopen_count": 0,
      "reassignment_count": 0,
      "agent_fcr_history": 0.75,
      "category_non_fcr_rate": 0.20
    },
    {
      "ticket_id": "TICK-002",
      "priority_id": 4,
      "category": "hardware",
      "duration": 180,
      "reopen_count": 1,
      "reassignment_count": 0,
      "agent_fcr_history": 0.65,
      "category_non_fcr_rate": 0.35
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "count": 2,
  "high_risk_count": 0,
  "medium_risk_count": 1,
  "predictions": [
    {
      "ticket_id": "TICK-001",
      "risk_score": 0.45,
      "risk_level": "medium",
      "confidence": 0.72,
      "drivers": [...],
      "recommendations": [...]
    },
    {
      "ticket_id": "TICK-002",
      "risk_score": 0.62,
      "risk_level": "medium",
      "confidence": 0.75,
      "drivers": [...],
      "recommendations": [...]
    }
  ]
}
```

---

### 2. Workload Optimization

#### Analyze Current Workload
```
POST /workload/analyze
```

**Description:** Analyze current workload distribution across team

**Request Body:**
```json
{
  "team_members": [
    {
      "user_id": "emp_001",
      "employee_name": "John Doe",
      "current_tickets": 15,
      "sla_compliance": 90,
      "fcr_rate": 75,
      "experience_level": 2,
      "capacity": 20
    },
    {
      "user_id": "emp_002",
      "employee_name": "Jane Smith",
      "current_tickets": 8,
      "sla_compliance": 85,
      "fcr_rate": 70,
      "experience_level": 1,
      "capacity": 15
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "analysis": {
    "mean": 11.5,
    "std_dev": 3.5,
    "coefficient_of_variation": 0.30,
    "imbalance_ratio": 1.87,
    "total_workload": 23,
    "min_load": 8,
    "max_load": 15,
    "fairness_score": 0.75
  },
  "status": "imbalanced",
  "fairness_score": 0.75
}
```

---

#### Get Workload Recommendations
```
POST /workload/balance
```

**Description:** Generate optimal workload distribution recommendations

**Request Body:**
```json
{
  "team_members": [
    {
      "user_id": "emp_001",
      "employee_name": "John Doe",
      "current_tickets": 15,
      "sla_compliance": 90,
      "fcr_rate": 75,
      "experience_level": 2,
      "capacity": 20
    },
    {
      "user_id": "emp_002",
      "employee_name": "Jane Smith",
      "current_tickets": 8,
      "sla_compliance": 85,
      "fcr_rate": 70,
      "experience_level": 1,
      "capacity": 15
    }
  ],
  "incoming_tickets": 10
}
```

**Response (200 OK):**
```json
{
  "recommendations": [
    {
      "user_id": "emp_001",
      "employee_name": "John Doe",
      "current_load": 15,
      "recommended_load": 16.8,
      "adjustment": 1.8,
      "tickets_to_assign": 1,
      "tickets_to_release": 0,
      "utilization_rate": 0.84,
      "sla_compliance": 90,
      "fcr_rate": 75,
      "performance_weight": 1.12
    },
    {
      "user_id": "emp_002",
      "employee_name": "Jane Smith",
      "current_load": 8,
      "recommended_load": 8.2,
      "adjustment": 0.2,
      "tickets_to_assign": 0,
      "tickets_to_release": 0,
      "utilization_rate": 0.55,
      "sla_compliance": 85,
      "fcr_rate": 70,
      "performance_weight": 0.88
    }
  ],
  "is_balanced": true,
  "optimization_status": "optimal",
  "target_load": 17,
  "current_analysis": {
    "mean": 11.5,
    "std_dev": 3.5,
    "coefficient_of_variation": 0.30,
    "imbalance_ratio": 1.87,
    "fairness_score": 0.75
  },
  "optimized_analysis": {
    "mean": 17,
    "std_dev": 2.1,
    "coefficient_of_variation": 0.12,
    "imbalance_ratio": 1.12,
    "fairness_score": 0.95
  },
  "total_reassignments": 1,
  "fairness_score": 0.95,
  "implementation_difficulty": "low",
  "business_impact": {
    "sla_impact": "positive",
    "fcr_impact": "positive",
    "employee_satisfaction": "positive",
    "implementation_risk": "low"
  }
}
```

---

#### Predict Staffing Needs
```
POST /workload/staffing
```

**Description:** Predict staffing needs based on volume forecast

**Request Body:**
```json
{
  "forecast_volume": [20, 25, 22, 28, 30, 25, 23],
  "current_team_size": 5,
  "avg_capacity": 20
}
```

**Response (200 OK):**
```json
{
  "current_team_size": 5,
  "needed_for_average_volume": 6,
  "needed_for_peak_volume": 7,
  "recommended_team_size": 6,
  "staffing_change": 1,
  "peak_staffing_change": 2,
  "utilization_at_recommended": 78,
  "implementation_timeline": "2-4 weeks",
  "cost_impact": {
    "annual_impact": 50000,
    "monthly_impact": 4166.67,
    "cost": 4166.67
  }
}
```

---

### 3. Diagnostics

#### Calculate KPIs
```
POST /diagnostics/kpis
```

**Description:** Calculate key performance indicators from ticket data

**Request Body:**
```json
{
  "tickets": [
    {
      "ticket_id": "TICK-001",
      "status": "resolved",
      "sla_met": true,
      "fcr": true,
      "duration": 90,
      "reopen_count": 0,
      "category": "software",
      "priority": 3
    },
    {
      "ticket_id": "TICK-002",
      "status": "resolved",
      "sla_met": false,
      "fcr": false,
      "duration": 200,
      "reopen_count": 1,
      "category": "hardware",
      "priority": 4
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "kpis": {
    "total_tickets": 2,
    "resolution_rate": 100.0,
    "sla_compliance": 50.0,
    "fcr_rate": 50.0,
    "reopen_rate": 50.0,
    "avg_resolution_time": 145.0
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

#### Detect Workload Imbalance
```
POST /diagnostics/imbalance
```

**Description:** Detect workload imbalances and fairness issues

**Request Body:**
```json
{
  "employee_workloads": [
    {"employee_id": "emp_001", "employee_name": "John", "current_workload": 20},
    {"employee_id": "emp_002", "employee_name": "Jane", "current_workload": 8}
  ]
}
```

**Response (200 OK):**
```json
{
  "imbalanced": true,
  "imbalance_ratio": 2.5,
  "coefficient_of_variation": 0.49,
  "mean_workload": 14.0,
  "max_workload": 20,
  "min_workload": 8,
  "std_workload": 6.0,
  "fairness_threshold": 0.25,
  "overloaded_employees": [
    {
      "employee_id": "emp_001",
      "employee_name": "John",
      "current_workload": 20,
      "deviation_from_mean": 6,
      "severity": "high"
    }
  ],
  "underloaded_employees": [
    {
      "employee_id": "emp_002",
      "employee_name": "Jane",
      "current_workload": 8,
      "deviation_from_mean": -6
    }
  ],
  "total_employees": 2,
  "recommendation": "Redistribute tickets from overloaded employees (1 identified)..."
}
```

---

#### Identify Bottlenecks
```
POST /diagnostics/bottlenecks
```

**Description:** Identify performance bottlenecks and issues

**Request Body:**
```json
{
  "team_performance": [
    {
      "name": "Team A",
      "resolution_rate": 65,
      "sla_compliance": 80,
      "fcr_rate": 60,
      "reopen_rate": 20
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "bottlenecks": [
    {
      "team": "Team A",
      "issue": "Low resolution rate",
      "value": 65,
      "severity": "high",
      "recommendation": "Review ticket complexity, provide targeted training..."
    },
    {
      "team": "Team A",
      "issue": "Low First-Contact Resolution rate",
      "value": 60,
      "severity": "medium",
      "recommendation": "Provide product/process training, review knowledge base"
    }
  ],
  "count": 2,
  "high_severity": 1
}
```

---

#### Analyze FCR Drivers
```
POST /diagnostics/fcr-drivers
```

**Description:** Identify root causes of Non-FCR issues

**Request Body:**
```json
{
  "tickets": [
    {
      "ticket_id": "TICK-001",
      "fcr": true,
      "category": "software",
      "priority": 2,
      "agent_name": "John",
      "reopen_count": 0
    },
    {
      "ticket_id": "TICK-002",
      "fcr": false,
      "category": "hardware",
      "priority": 4,
      "agent_name": "Jane",
      "reopen_count": 1
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "overall_fcr_rate": 50.0,
  "non_fcr_rate": 50.0,
  "total_tickets": 2,
  "non_fcr_tickets": 1,
  "drivers": [
    {
      "type": "category",
      "value": "hardware",
      "non_fcr_rate": 100,
      "impact": "high",
      "recommendation": "Provide training for hardware category issues"
    }
  ]
}
```

---

#### Detect Anomalies
```
POST /diagnostics/anomalies
```

**Description:** Detect anomalies in historical performance data

**Request Body:**
```json
{
  "historical_data": [
    {"date": "2024-01-01", "value": 25},
    {"date": "2024-01-02", "value": 28},
    {"date": "2024-01-03", "value": 26},
    {"date": "2024-01-04", "value": 65},
    {"date": "2024-01-05", "value": 27}
  ]
}
```

**Response (200 OK):**
```json
{
  "anomalies_detected": 1,
  "anomalies": [
    {
      "date": "2024-01-04",
      "value": 65,
      "expected_range": [20.5, 34.5],
      "deviation": 3.82,
      "severity": "high"
    }
  ]
}
```

---

### 4. Forecasting

#### Forecast Ticket Volume
```
POST /forecast/tickets
```

**Description:** Forecast future ticket volumes

**Request Body:**
```json
{
  "assignment_group_id": 1,
  "days_ahead": 7
}
```

**Response (200 OK):**
```json
{
  "group_id": 1,
  "days_ahead": 7,
  "forecast": {
    "mean": 26.5,
    "upper_bound": 32.4,
    "lower_bound": 20.6,
    "trend": "increasing"
  },
  "daily_forecast": [27, 28, 29, 28, 30, 31, 29],
  "confidence": 0.87,
  "model": "ARIMA(3,1,2)"
}
```

---

### 5. Model Information

#### Get Training Summary
```
GET /training/summary
```

**Description:** Get information about trained models

**Response (200 OK):**
```json
{
  "fcr_model": {
    "status": "trained",
    "type": "RandomForest",
    "threshold": 0.52,
    "feature_importance": {
      "priority": 0.18,
      "reopen_count": 0.22,
      "agent_fcr_history": 0.20,
      "category_non_fcr_rate": 0.18,
      "duration": 0.12
    }
  },
  "workload_model": {
    "status": "trained",
    "type": "GradientBoosting",
    "feature_importance": {
      "current_workload": 0.35,
      "sla_compliance": 0.25,
      "experience_level": 0.20,
      "fcr_rate": 0.15,
      "avg_resolution_time": 0.05
    }
  },
  "last_updated": "2024-01-01T10:00:00.000Z"
}
```

---

## Error Handling

### Error Response Format
```json
{
  "error": "Error message description",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Common Errors

| Status | Error | Solution |
|--------|-------|----------|
| 400 | Missing required fields | Verify all required fields in request |
| 400 | Invalid data format | Ensure data types match specification |
| 404 | Endpoint not found | Check endpoint URL and method |
| 500 | Internal server error | Check service logs for details |
| 503 | Database unavailable | Verify PostgreSQL connection |

---

## Rate Limiting & Performance

- No rate limiting currently applied
- Batch prediction: max 1000 tickets per request
- Recommend 100-200ms response time target
- Large datasets may require optimization

---

## Authentication (Future)

Will support Bearer token authentication:
```
Authorization: Bearer <token>
```

---

## Versioning

Current API Version: **v1** (production ready)

Future versions planned with:
- Extended model support
- Advanced optimization algorithms
- Real-time streaming predictions
