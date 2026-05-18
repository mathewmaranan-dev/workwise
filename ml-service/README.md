# Work-Wise ML Service

Machine learning microservice for the Work-Wise ITSM Decision Support System.

Provides predictive analytics for:
- Ticket volume forecasting
- Workload balancing optimization
- Performance diagnostics
- Anomaly detection
- First-Contact Resolution (FCR) risk prediction

## Quick Start

### Setup

```bash
cd ml-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Update `.env` with your database credentials:
```
DATABASE_URL=postgresql://user:password@localhost:5432/workwise_db
ML_PORT=5001
```

### Development

```bash
python app.py
```

ML Service will run on `http://localhost:5001`

## API Endpoints

### Forecasting
- `POST /api/ml/forecast/tickets` - Forecast ticket volume
  ```json
  {
    "assignment_group_id": 1,
    "days_ahead": 7
  }
  ```

### Workload Optimization
- `POST /api/ml/workload/balance` - Recommend workload balancing
  ```json
  {
    "assignment_group_id": 1,
    "target_date": "2026-05-10"
  }
  ```

### Performance Analytics
- `GET /api/ml/diagnostics/performance?group_id=1&period_days=30` - Team diagnostics
- `GET /api/ml/anomalies/detect?group_id=1` - Detect anomalies

### Risk Prediction
- `POST /api/ml/fcr/predict` - Predict FCR risk
  ```json
  {
    "ticket_category": "Hardware",
    "priority": "High",
    "assigned_group": 1
  }
  ```

## Project Structure

```
ml-service/
├── app.py                  # Flask app and main routes
├── requirements.txt        # Python dependencies
├── .env.example           # Environment template
├── services/              # ML service modules
│   ├── forecasting.py     # Ticket volume forecasting
│   ├── workload_optimization.py  # Load balancing
│   ├── diagnostics.py     # Performance analysis
│   └── fcr_prediction.py  # FCR risk prediction
└── models/                # Trained model files
```

## Models Implemented

1. **ARIMA** - Time series forecasting for ticket volumes
2. **K-Means Clustering** - Workload distribution analysis
3. **Random Forest** - FCR risk classification
4. **Isolation Forest** - Anomaly detection

## Integration with Backend

The ML service communicates with the Node.js backend via REST APIs.
Backend calls ML service endpoints for predictions and sends results back to the frontend.

## Deployment

Deploy on Render or similar platform with:
- Python 3.11+
- PostgreSQL connection
- Environment variables configured

## Next Steps

1. Implement model training pipeline with real data
2. Add model persistence and versioning
3. Create performance benchmarking
4. Integrate real-time predictions
5. Add model monitoring and retraining schedule
