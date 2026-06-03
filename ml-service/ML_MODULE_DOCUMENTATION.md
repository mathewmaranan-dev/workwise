# Work-Wise ML Module Documentation

## Overview

Work-Wise ML Service is a comprehensive machine learning module for ITSM support desk operations. It provides intelligent decision support through:

- **Diagnostic Analytics**: Detect workload imbalances, performance bottlenecks, and Non-FCR drivers
- **Predictive Analytics**: Forecast ticket volumes, predict FCR risk, and identify workload imbalance risks  
- **Prescriptive Analytics**: Recommend optimal workload distribution with fairness constraints and staffing needs

## Architecture

### Core Modules

#### 1. **Data Preprocessing** (`data_preprocessing.py`)
Handles data extraction, cleaning, feature engineering, and normalization.

**Key Classes:**
- `DataPreprocessor`: Main preprocessing class with methods for:
  - `extract_ticket_features()`: Extract features from raw ticket data
  - `engineer_employee_features()`: Calculate KPIs from employee ticket history
  - `prepare_workload_dataset()`: Prepare data for workload analysis
  - `prepare_fcr_dataset()`: Prepare features for FCR prediction
  - `normalize_features()`: Standardize feature values
  - `create_time_series_data()`: Create time-series datasets for forecasting
  - `handle_missing_values()`: Clean missing data
  - `remove_outliers()`: Detect and remove statistical outliers

#### 2. **Database Integration** (`database_integration.py`)
Manages PostgreSQL connections and data retrieval.

**Key Classes:**
- `DatabaseConnector`: Handles all database operations:
  - `get_tickets()`: Fetch ticket data with optional filters
  - `get_employees()`: Retrieve employee performance metrics
  - `get_assignment_groups()`: Get team/group data
  - `save_model_prediction()`: Store predictions for audit/analysis
  - `get_ticket_categories()`: Retrieve category classifications

#### 3. **Model Training & Evaluation** (`model_training.py`)
Trains, evaluates, and persists ML models.

**Key Classes:**
- `ModelTrainer`: Manages model lifecycle:
  - `train_fcr_model()`: Train FCR risk prediction model (RandomForest)
  - `train_workload_model()`: Train workload imbalance model (GradientBoosting)
  - `evaluate_model()`: Evaluate trained models
  - `get_feature_importance()`: Extract feature importance
  - `create_training_report()`: Generate training summary

#### 4. **Performance Diagnostics** (`diagnostics.py`)
Comprehensive performance analysis and anomaly detection.

**Key Classes:**
- `PerformanceDiagnostics`: Main diagnostics engine:
  - `calculate_kpis()`: Compute key performance indicators (SLA, FCR, resolution rate, etc.)
  - `identify_bottlenecks()`: Detect performance issues
  - `detect_performance_anomalies()`: Use Isolation Forest for anomaly detection
  - `detect_workload_imbalance()`: Analyze workload distribution fairness
  - `detect_non_fcr_drivers()`: Identify root causes of Non-FCR issues

#### 5. **FCR Prediction** (`fcr_prediction.py`)
First-Contact Resolution risk prediction with explainability.

**Key Classes:**
- `FCRPredictor`: Risk prediction and explanation:
  - `predict_fcr_risk()`: Predict Non-FCR likelihood for a ticket
  - `_build_drivers()`: Identify and explain risk drivers
  - `_get_recommendations()`: Generate actionable recommendations
  - `_get_priority_actions()`: Provide top priority interventions

**Risk Drivers Detected:**
- Ticket complexity (priority level)
- Reopen history (strong indicator of resolution quality)
- Reassignment count
- Resolution time
- Ticket category-level patterns
- Agent experience and historical FCR rate
- Category-level Non-FCR rates

#### 6. **Workload Optimization** (`workload_optimization.py`)
Intelligent workload distribution with fairness constraints.

**Key Classes:**
- `WorkloadOptimizer`: Optimization engine:
  - `analyze_current_load()`: Calculate workload distribution metrics
  - `recommend_distribution()`: Generate balanced assignments
  - `predict_staffing_needs()`: Calculate required team size
  - `_optimize_with_fairness()`: Apply fairness constraints (configurable 25% threshold)

**Optimization Features:**
- Performance-weighted distribution (higher performers handle more)
- Fairness constraints (prevent extreme imbalances)
- Experience level consideration
- Capacity-aware recommendations
- Implementation difficulty assessment
- Cost impact estimation

#### 7. **Ticket Forecasting** (`forecasting.py`)
Time-series forecasting for ticket volumes.

**Key Classes:**
- `TicketForecast`: Forecasting engine:
  - `forecast()`: ARIMA-based volume prediction
  - Fallback to deterministic methods if ARIMA fails
  - Provides confidence intervals

### REST API Endpoints

#### Health & Status
```
GET /health                    - Service health check
GET /api/ml/status            - Service status and available endpoints
```

#### FCR Prediction
```
POST /api/ml/fcr/predict      - Predict FCR risk for single ticket
POST /api/ml/fcr/batch-predict - Batch predict for multiple tickets
```

#### Workload Optimization
```
POST /api/ml/workload/analyze  - Analyze current workload distribution
POST /api/ml/workload/balance  - Get workload balancing recommendations
POST /api/ml/workload/staffing - Predict staffing needs
```

#### Diagnostics
```
POST /api/ml/diagnostics/kpis       - Calculate KPIs
POST /api/ml/diagnostics/imbalance  - Detect workload imbalances
POST /api/ml/diagnostics/bottlenecks - Identify performance issues
POST /api/ml/diagnostics/fcr-drivers - Analyze Non-FCR drivers
POST /api/ml/diagnostics/anomalies  - Detect performance anomalies
```

#### Forecasting
```
POST /api/ml/forecast/tickets - Forecast ticket volume
```

#### Model Management
```
GET /api/ml/training/summary - Get trained models info
```

## Request/Response Examples

### FCR Risk Prediction
**Request:**
```json
{
  "ticket_id": "TICK-001",
  "priority_id": 3,
  "category": "software",
  "duration": 120,
  "reopen_count": 0,
  "reassignment_count": 0,
  "agent_fcr_history": 0.75,
  "category_non_fcr_rate": 0.20
}
```

**Response:**
```json
{
  "risk_score": 0.45,
  "risk_level": "medium",
  "confidence": 0.72,
  "model_type": "trained_model",
  "drivers": [
    {
      "type": "complexity",
      "factor": "Priority 3 (High priority complexity)",
      "impact": "medium",
      "contribution_to_risk": 0.24,
      "explanation": "Higher priority tickets tend to be more complex..."
    }
  ],
  "recommendations": [
    "Route to experienced agent or team",
    "Consider knowledge base consultation"
  ],
  "intervention_required": true,
  "priority_actions": ["Recommended: Assign to experienced team member"]
}
```

### Workload Balancing
**Request:**
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
    }
  ],
  "incoming_tickets": 10
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "user_id": "emp_001",
      "employee_name": "John Doe",
      "current_load": 15,
      "recommended_load": 18.5,
      "adjustment": 3.5,
      "tickets_to_assign": 3,
      "utilization_rate": 0.925,
      "sla_compliance": 90,
      "fcr_rate": 75,
      "performance_weight": 1.08
    }
  ],
  "is_balanced": true,
  "optimization_status": "optimal",
  "target_load": 18.5,
  "fairness_score": 0.92,
  "implementation_difficulty": "low"
}
```

## Model Architecture

### FCR Risk Prediction Model

**Input Features (Primary):**
- priority_id (1-5 scale)
- reopen_count (0-n)
- reassignment_count (0-n)
- duration (minutes)
- ticket_complexity (0-12)
- agent_fcr_history (0-1)
- category_non_fcr_rate (0-1)

**Model Type:** RandomForest Classifier with hyperparameter tuning
- n_estimators: [50, 100, 200]
- max_depth: [5, 10, 15]
- class_weight: balanced

**Performance Metrics:**
- ROC-AUC score
- Precision/Recall/F1
- Confusion Matrix
- Cross-validation scores

**Threshold Optimization:** Youden's index for optimal probability threshold

### Workload Imbalance Model

**Input Features:**
- current_workload
- sla_compliance
- fcr_rate
- avg_resolution_time
- experience_level
- workload_capacity

**Model Type:** GradientBoosting Regressor
- n_estimators: [50, 100, 150]
- learning_rate: [0.01, 0.05, 0.1]
- loss: 'huber'

**Performance Metrics:**
- R² score
- RMSE
- MAE

## Configuration

### Environment Variables
```
DATABASE_URL=postgresql://user:password@host:5432/workwise
FLASK_ENV=development|production
ML_SERVICE_PORT=5000
```

### Fairness Constraints
- **Fairness Threshold:** 0.25 (25% max workload ratio difference)
- **Max Workload Ratio:** 1.5 (max/min workload ratio)
- **Base Utilization Target:** 85% (leaving 15% buffer for quality)

## Key Algorithms

### 1. Workload Imbalance Detection
Uses coefficient of variation and max/min ratio analysis:
```
CV = std_workload / mean_workload
Imbalance Ratio = max_workload / min_workload
Fairness Score = 1 - min(Imbalance Ratio / max_threshold, 1)
```

### 2. Non-FCR Driver Analysis
- **Category Analysis:** Compare category FCR rate vs. overall FCR rate
- **Priority Analysis:** Identify high-priority tickets with lower FCR
- **Agent Analysis:** Compare individual agent FCR rates
- **Pattern Recognition:** Detect recurring issue types

### 3. Optimal Workload Distribution
- **Performance Weighting:** Scale assignments by employee efficiency score
- **Fairness Constraints:** Enforce maximum workload ratio
- **Capacity Awareness:** Respect individual capacity limits
- **Iterative Balancing:** Gradually distribute incoming tickets

### 4. Staffing Needs Prediction
```
Needed Staff = (Max Forecast Volume / Avg Capacity) / 0.85
Staffing Change = Needed Staff - Current Team Size
```

## Explainability & Interpretability

### SHAP-like Explanations
All predictions include:
- **Risk Drivers:** Specific factors contributing to risk
- **Impact Levels:** High/Medium/Low severity classification
- **Contribution Scores:** Quantified impact of each driver
- **Recommendations:** Actionable interventions

### Business-Friendly Output
- Natural language explanations
- Visual-ready metrics (scores 0-1, percentages)
- Clear action priorities
- Cost/benefit analysis for staffing changes

## Data Quality & Validation

### Input Validation
- Required field checking
- Type validation
- Range validation (scores 0-1, counts ≥ 0)
- Outlier detection and handling

### Data Preprocessing
- Missing value imputation (mean, median, forward fill)
- Outlier removal using z-score (threshold: 3.0)
- Feature normalization (StandardScaler)
- Categorical encoding (one-hot)

## Performance Metrics & KPIs

**Tracked KPIs:**
- SLA Compliance %
- FCR Rate %
- Resolution Rate %
- Reopen Rate %
- Average Resolution Time (hours)
- Workload Distribution Ratio
- Fairness Score (0-1)

**Model Evaluation Metrics:**
- FCR Model: ROC-AUC, Precision, Recall, F1-Score
- Workload Model: R², RMSE, MAE
- Cross-validation scores

## Deployment & Scaling

### Architecture
- Microservice design (separate from backend)
- Stateless API (all state in DB)
- Async model prediction capability
- Batch processing support

### Scalability Features
- Efficient data preprocessing (vectorized NumPy operations)
- Caching of model predictions
- Connection pooling for database
- Horizontal scaling ready

## Future Enhancements

1. **Advanced Optimization:**
   - Reinforcement learning for dynamic workload balancing
   - Multi-objective optimization (SLA + FCR + Utilization)
   - Real-time recommendation updates

2. **Extended Analytics:**
   - Root cause analysis (RCA) for critical issues
   - Skill-based routing for ticket assignment
   - Customer satisfaction impact modeling

3. **Automation:**
   - Automatic model retraining pipeline
   - Drift detection and model updates
   - Anomaly alert notifications

4. **Integration:**
   - Business intelligence dashboards
   - Mobile app recommendations
   - Slack/Teams bot integration

## Troubleshooting

### Common Issues

**Issue:** "Model not found" warning
- **Cause:** Trained models haven't been persisted
- **Solution:** Train models using training endpoint or ensure models directory exists

**Issue:** Low prediction confidence
- **Cause:** Insufficient training data or heuristic mode
- **Solution:** Ensure adequate historical data (90+ days) for training

**Issue:** Workload recommendations too aggressive
- **Cause:** Fairness threshold may be too strict
- **Solution:** Adjust `fairness_threshold` in WorkloadOptimizer configuration

## Support & Maintenance

- **Logs:** Check Flask logs for detailed error messages
- **Database:** Ensure PostgreSQL connection and schema integrity
- **Models:** Periodically retrain with fresh data (monthly recommended)
- **Performance:** Monitor API response times and memory usage

## References

- [Scikit-learn Documentation](https://scikit-learn.org/)
- [XGBoost Documentation](https://xgboost.readthedocs.io/)
- [ARIMA Time Series](https://www.statsmodels.org/)
- [Flask REST API](https://flask.palletsprojects.com/)
