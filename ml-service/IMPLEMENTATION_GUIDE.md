# Work-Wise ML Module - Implementation Guide

## Quick Start

### 1. Environment Setup

```bash
cd d:\Workwise\ml-service

# Create virtual environment (Windows)
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configuration

Create `.env` file:
```
DATABASE_URL=postgresql://user:password@localhost:5432/workwise
FLASK_ENV=development
ML_SERVICE_PORT=5000
DEBUG=True
```

### 3. Run Service

```bash
# Development mode
python app.py

# Production mode (set FLASK_ENV=production)
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### 4. Verify Installation

```bash
# Health check
curl http://localhost:5000/health

# Expected response:
{
  "status": "OK",
  "service": "Work-Wise ML Service",
  "models_loaded": {
    "fcr_model": false,
    "workload_model": false
  }
}
```

---

## Component Integration

### Data Preprocessing Pipeline

#### Basic Usage
```python
from services.data_preprocessing import DataPreprocessor

preprocessor = DataPreprocessor()

# Extract ticket features
ticket = {
    'ticket_id': 'TICK-001',
    'priority': 3,
    'category': 'software',
    'duration': 120,
    'created_at': '2024-01-01T10:00:00',
    'resolved_at': '2024-01-01T12:00:00',
    'reopen_count': 0,
    'reassignment_count': 0,
    'sla_met': True,
    'fcr': True,
}

features = preprocessor.extract_ticket_features(ticket)
print(features)
# Output: {
#   'resolution_time': 120.0,
#   'priority': 3.0,
#   'reopen_count': 0.0,
#   ...
# }
```

#### Prepare for Model Training
```python
# Prepare FCR training dataset
tickets = [...]  # List of ticket dictionaries
X, feature_names = preprocessor.prepare_fcr_dataset(tickets)

# Normalize features
X_normalized = preprocessor.normalize_features(X, fit=True)

# Handle missing values
df = preprocessor.handle_missing_values(df, strategy='mean')

# Remove outliers
df_clean = preprocessor.remove_outliers(df, columns=['resolution_time'], threshold=3.0)
```

---

### Database Integration

#### Setup
```python
from services.database_integration import DatabaseConnector

db = DatabaseConnector()

# Test connection
if db.connect():
    print("✅ Connected to database")
    
    # Fetch tickets
    tickets = db.get_tickets(days_back=90, group_id=1)
    
    # Fetch employees
    employees = db.get_employees(group_id=1)
    
    # Get groups
    groups = db.get_assignment_groups()
    
    db.disconnect()
else:
    print("❌ Connection failed")
```

#### Save Predictions
```python
# Save FCR risk prediction
success = db.save_model_prediction(
    prediction_type='fcr_risk',
    ticket_id=123,
    prediction=0.65,
    confidence=0.82
)
```

---

### Model Training & Evaluation

#### Train Models
```python
from services.model_training import ModelTrainer
from services.data_preprocessing import DataPreprocessor
from services.database_integration import DatabaseConnector

# Setup
trainer = ModelTrainer(model_dir='ml-service/models')
preprocessor = DataPreprocessor()
db = DatabaseConnector()
db.connect()

# Fetch data
tickets = db.get_tickets(days_back=90)
employees = db.get_employees()

# Prepare FCR training data
X, feature_names = preprocessor.prepare_fcr_dataset(tickets)
y = np.array([t.get('fcr', 1) for t in tickets])  # 1 = Non-FCR, 0 = FCR

# Train FCR model
fcr_results = trainer.train_fcr_model(X, y, feature_names)
print(f"FCR Model ROC-AUC: {fcr_results['metrics']['roc_auc']:.4f}")

# Prepare workload training data
workload_data = []
for emp in employees:
    emp_tickets = [t for t in tickets if t.get('assigned_to') == emp.get('id')]
    workload_features = preprocessor.engineer_employee_features(emp, emp_tickets)
    workload_data.append(workload_features)

workload_feature_names = ['sla_compliance', 'fcr_rate', 'avg_resolution_time', 
                          'reopen_rate', 'ticket_count', 'experience_level']
X_workload = np.array([[w[name] for name in workload_feature_names] for w in workload_data])
y_workload = np.array([calculate_imbalance_score(w) for w in workload_data])

# Train workload model
workload_results = trainer.train_workload_model(X_workload, y_workload, workload_feature_names)
print(f"Workload Model R²: {workload_results['metrics']['r2_score']:.4f}")

# Generate training report
report = trainer.create_training_report(fcr_results, workload_results)
print(report)

db.disconnect()
```

---

### Diagnostics Engine

#### Performance Analysis
```python
from services.diagnostics import PerformanceDiagnostics

diagnostics = PerformanceDiagnostics()

# Calculate KPIs
tickets = [...]  # Ticket data
kpis = diagnostics.calculate_kpis(tickets)
print(f"SLA Compliance: {kpis['sla_compliance']:.1f}%")
print(f"FCR Rate: {kpis['fcr_rate']:.1f}%")

# Identify bottlenecks
team_performance = [
    {'name': 'Team A', 'resolution_rate': 75, 'sla_compliance': 88, 'fcr_rate': 65},
    {'name': 'Team B', 'resolution_rate': 65, 'sla_compliance': 75, 'fcr_rate': 60}
]
bottlenecks = diagnostics.identify_bottlenecks(team_performance)
for bn in bottlenecks:
    print(f"{bn['team']}: {bn['issue']} ({bn['severity']})")

# Detect workload imbalances
employee_workloads = [
    {'employee_id': 'emp_001', 'employee_name': 'John', 'current_workload': 18},
    {'employee_id': 'emp_002', 'employee_name': 'Jane', 'current_workload': 8}
]
imbalance = diagnostics.detect_workload_imbalance(employee_workloads)
print(f"Imbalanced: {imbalance['imbalanced']}")
print(f"Fairness Score: {imbalance['fairness_score']:.2f}")

# Detect FCR drivers
drivers = diagnostics.detect_non_fcr_drivers(tickets)
for driver in drivers:
    print(f"Driver: {driver['type']} - {driver['value']} ({driver['impact']})")
```

---

### FCR Prediction

#### Single Prediction
```python
from services.fcr_prediction import FCRPredictor

predictor = FCRPredictor()

ticket_features = {
    'priority_id': 3,
    'reopen_count': 0,
    'reassignment_count': 0,
    'duration': 120,
    'ticket_complexity': 5,
    'agent_fcr_history': 0.75,
    'category_non_fcr_rate': 0.20
}

prediction = predictor.predict_fcr_risk(ticket_features)

print(f"Risk Score: {prediction['risk_score']:.2f}")
print(f"Risk Level: {prediction['risk_level']}")
print(f"Confidence: {prediction['confidence']:.2f}")

for driver in prediction['drivers']:
    print(f"  - {driver['factor']}: {driver['impact']}")

for rec in prediction['recommendations']:
    print(f"  - {rec}")
```

---

### Workload Optimization

#### Generate Recommendations
```python
from services.workload_optimization import WorkloadOptimizer

optimizer = WorkloadOptimizer(fairness_threshold=0.25, max_workload_ratio=1.5)

team_members = [
    {
        'user_id': 'emp_001',
        'employee_name': 'John Doe',
        'current_tickets': 18,
        'sla_compliance': 92,
        'fcr_rate': 78,
        'experience_level': 2,
        'capacity': 20
    },
    {
        'user_id': 'emp_002',
        'employee_name': 'Jane Smith',
        'current_tickets': 8,
        'sla_compliance': 85,
        'fcr_rate': 70,
        'experience_level': 1,
        'capacity': 15
    }
]

# Analyze current state
analysis = optimizer.analyze_current_load(team_members)
print(f"Current Imbalance Ratio: {analysis['imbalance_ratio']:.2f}")
print(f"Fairness Score: {analysis['fairness_score']:.2f}")

# Get optimization recommendations
incoming_tickets = 12
recommendations = optimizer.recommend_distribution(team_members, incoming_tickets)

for rec in recommendations['recommendations']:
    print(f"{rec['employee_name']}: {rec['current_load']} → {rec['recommended_load']}")
    if rec['tickets_to_assign'] > 0:
        print(f"  Assign: {rec['tickets_to_assign']} tickets")

print(f"Optimization Status: {recommendations['optimization_status']}")
print(f"Fairness Score: {recommendations['fairness_score']:.2f}")

# Predict staffing needs
forecast_volume = [20, 25, 22, 28, 30, 25, 23]
staffing = optimizer.predict_staffing_needs(forecast_volume, current_team_size=5, avg_capacity=20)
print(f"Current Team: {staffing['current_team_size']}")
print(f"Recommended: {staffing['recommended_team_size']}")
print(f"Change: +{staffing['staffing_change']} staff")
print(f"Timeline: {staffing['implementation_timeline']}")
```

---

### Forecasting

#### Predict Ticket Volume
```python
from services.forecasting import TicketForecast

forecaster = TicketForecast()

# Forecast 14 days ahead
result = forecaster.forecast(assignment_group_id=1, days_ahead=14)

print(f"Model: {result['model']}")
print(f"R² Score: {result['rsquared']:.3f}")
print(f"Forecast: {result['forecast']}")
print(f"Upper Bound: {result['upper_bound']}")
print(f"Lower Bound: {result['lower_bound']}")
```

---

## Integration with Backend

### Call ML Service from Backend

```typescript
// backend/src/routes/mlAnalytics.ts
import axios from 'axios';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000/api/ml';

export async function predictFCRRisk(ticketData: any) {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/fcr/predict`, ticketData);
    return response.data;
  } catch (error) {
    console.error('FCR prediction error:', error);
    throw error;
  }
}

export async function getWorkloadRecommendations(teamData: any) {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/workload/balance`, teamData);
    return response.data;
  } catch (error) {
    console.error('Workload recommendation error:', error);
    throw error;
  }
}

export async function forecastTickets(groupId: number, daysAhead: number = 7) {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/forecast/tickets`, {
      assignment_group_id: groupId,
      days_ahead: daysAhead
    });
    return response.data;
  } catch (error) {
    console.error('Forecast error:', error);
    throw error;
  }
}
```

### Display Recommendations in Dashboard

```tsx
// frontend/src/pages/AnalyticsDashboard.tsx
import { useEffect, useState } from 'react';

export function AnalyticsDashboard() {
  const [fcr Risks, setFCRRisks] = useState<any[]>([]);
  const [workloadRecs, setWorkloadRecs] = useState<any>(null);

  useEffect(() => {
    // Fetch FCR predictions
    fetch('/api/ml/fcr/batch-predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tickets: [...ticketData] })
    })
      .then(r => r.json())
      .then(data => setFCRRisks(data.predictions));

    // Fetch workload recommendations
    fetch('/api/ml/workload/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_members: [...teamData], incoming_tickets: 10 })
    })
      .then(r => r.json())
      .then(data => setWorkloadRecs(data));
  }, []);

  return (
    <div>
      <h1>ML Analytics Dashboard</h1>
      
      {/* FCR Risk Display */}
      <section>
        <h2>FCR Risk Predictions</h2>
        {fcrRisks.map(risk => (
          <div key={risk.ticket_id} className={`risk-${risk.risk_level}`}>
            <h3>{risk.ticket_id} - {risk.risk_level.toUpperCase()}</h3>
            <p>Risk Score: {(risk.risk_score * 100).toFixed(0)}%</p>
            <ul>
              {risk.drivers.map((d: any, i: number) => (
                <li key={i}>{d.factor} ({d.impact})</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* Workload Recommendations */}
      <section>
        <h2>Workload Balancing</h2>
        {workloadRecs && (
          <>
            <p>Status: {workloadRecs.optimization_status}</p>
            <p>Fairness Score: {(workloadRecs.fairness_score * 100).toFixed(0)}%</p>
            {workloadRecs.recommendations.map((rec: any, i: number) => (
              <div key={i}>
                <h3>{rec.employee_name}</h3>
                <p>Current: {rec.current_load} → Recommended: {rec.recommended_load}</p>
              </div>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
```

---

## Testing

### Unit Tests

```python
# tests/test_diagnostics.py
import unittest
from services.diagnostics import PerformanceDiagnostics

class TestDiagnostics(unittest.TestCase):
    def setUp(self):
        self.diagnostics = PerformanceDiagnostics()
    
    def test_calculate_kpis(self):
        tickets = [
            {'status': 'resolved', 'sla_met': True, 'fcr': True, 'duration': 90},
            {'status': 'resolved', 'sla_met': False, 'fcr': False, 'duration': 200},
        ]
        kpis = self.diagnostics.calculate_kpis(tickets)
        
        self.assertEqual(kpis['total_tickets'], 2)
        self.assertEqual(kpis['resolution_rate'], 100.0)
        self.assertEqual(kpis['sla_compliance'], 50.0)
        self.assertEqual(kpis['fcr_rate'], 50.0)
    
    def test_detect_imbalance(self):
        workloads = [
            {'employee_id': 'e1', 'current_workload': 20},
            {'employee_id': 'e2', 'current_workload': 8}
        ]
        result = self.diagnostics.detect_workload_imbalance(workloads)
        
        self.assertTrue(result['imbalanced'])
        self.assertGreater(result['imbalance_ratio'], 1.5)

if __name__ == '__main__':
    unittest.main()
```

### API Tests

```bash
# Test FCR prediction
curl -X POST http://localhost:5000/api/ml/fcr/predict \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "TICK-001",
    "priority_id": 3,
    "category": "software",
    "duration": 120
  }'

# Test workload balance
curl -X POST http://localhost:5000/api/ml/workload/balance \
  -H "Content-Type: application/json" \
  -d '{
    "team_members": [
      {"user_id": "e1", "current_tickets": 15, "sla_compliance": 90}
    ],
    "incoming_tickets": 5
  }'
```

---

## Monitoring & Maintenance

### Key Metrics to Monitor
- API response times (target: <200ms)
- Model prediction accuracy
- Database query performance
- Service uptime
- Error rates

### Regular Maintenance Tasks
1. **Weekly**: Check logs for errors, review performance metrics
2. **Monthly**: Retrain models with fresh data, validate predictions
3. **Quarterly**: Update fairness thresholds based on business needs
4. **Annually**: Comprehensive performance review and optimization

### Logging

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ml_service.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)
logger.info("FCR model trained successfully")
logger.warning("Low prediction confidence detected")
logger.error("Database connection failed")
```

---

## Troubleshooting Guide

| Issue | Cause | Solution |
|-------|-------|----------|
| "Model not found" | Models not trained | Train models using trainer.train_fcr_model() |
| Slow predictions | Large dataset | Batch process predictions, optimize queries |
| Low confidence | Insufficient data | Collect more historical data (90+ days) |
| Imbalanced recommendations | Fairness threshold too strict | Adjust fairness_threshold parameter |
| DB connection errors | Connection string wrong | Verify DATABASE_URL in .env |

---

## Additional Resources

- [ML Module Documentation](./ML_MODULE_DOCUMENTATION.md)
- [API Reference](./API_REFERENCE.md)
- [Database Schema](#) (separate file)
- [Deployment Guide](#) (separate file)
