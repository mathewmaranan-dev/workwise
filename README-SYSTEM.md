# Work-Wise: Intelligent Multi-Level Decision Support System
## ITSM Operations with ML Forecasting, Performance Diagnostics, and Workload Optimization

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

A comprehensive ITSM decision support system that leverages machine learning to optimize ticket routing, predict workload, and provide performance diagnostics. Built for thesis research and real-world ITSM operations.

## ✨ Features

- **🎫 Ticket Management**: Complete ITSM workflow with SLA tracking
- **🤖 ML Forecasting**: Predict ticket volumes and resolution times
- **📊 Performance Diagnostics**: Identify bottlenecks and inefficiencies
- **⚖️ Workload Optimization**: Smart agent assignment and capacity planning
- **📈 Real-time Analytics**: KPI dashboards and reporting
- **🔐 Role-based Access**: Admin, Manager, Agent, and HR roles
- **📱 Responsive UI**: Modern React interface with Tailwind CSS

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend│────│  Node.js Backend │────│  PostgreSQL DB  │
│   (Vite + TS)   │    │  (Express + TS)  │    │   + ML Service   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │ Python ML Service│
                       │ (Flask + SciKit) │
                       └─────────────────┘
```

### Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript + PostgreSQL
- **ML Service**: Python + Flask + Scikit-learn + Pandas
- **Database**: PostgreSQL 16 with 18-table ITSM schema
- **Deployment**: Render (PostgreSQL + Web Services)
- **Development**: Docker + Docker Compose

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.9+ and pip
- Git
- Docker (optional, for local development)

### Local Development

1. **Clone and setup**:
   ```bash
   git clone https://github.com/yourusername/work-wise-itsm.git
   cd work-wise-itsm
   ```

2. **Install dependencies**:
   ```bash
   # Frontend
   npm install

   # Backend
   cd backend && npm install

   # ML Service
   cd ../ml-service && pip install -r requirements.txt
   ```

3. **Start services**:
   ```bash
   # From project root
   docker compose up

   # Or run individually:
   # Backend: cd backend && npm run dev
   # ML Service: cd ml-service && python app.py
   # Frontend: cd frontend && npm run dev
   ```

4. **Access the application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000
   - ML Service: http://localhost:5001

## 📁 Project Structure

```
work-wise-itsm/
├── frontend/              # React + TypeScript + Vite
│   ├── src/
│   │   ├── main.tsx
│   │   ├── app/
│   │   │   ├── App.tsx
│   │   │   ├── routes.tsx
│   │   │   ├── components/
│   │   │   │   ├── LoadingSpinner.tsx
│   │   │   │   ├── StatCard.tsx
│   │   │   │   ├── SystemInfo.tsx
│   │   │   │   ├── WelcomeBanner.tsx
│   │   │   │   ├── figma/
│   │   │   │   └── ui/        # shadcn/ui components
│   │   │   ├── context/
│   │   │   │   ├── AuthContext.tsx
│   │   │   │   ├── DataContext.tsx
│   │   │   │   └── TicketsContext.tsx
│   │   │   ├── data/
│   │   │   │   └── seedData.ts
│   │   │   ├── pages/
│   │   │   │   ├── DashboardLayout.tsx
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   ├── NotFoundPage.tsx
│   │   │   │   ├── UploadPage.tsx
│   │   │   │   ├── UserManagementPage.tsx
│   │   │   │   └── dashboards/
│   │   │   └── utils/
│   │   │       ├── analytics.ts
│   │   │       ├── businessLogic.ts
│   │   │       ├── csvUtils.ts
│   │   │       ├── mlAlgorithms.ts
│   │   │       └── sampleDataGenerator.ts
│   │   └── styles/
│   │       ├── fonts.css
│   │       ├── index.css
│   │       ├── tailwind.css
│   │       └── theme.css
│   ├── index.html         # Frontend entry point
│   ├── package.json       # Frontend dependencies
│   ├── vite.config.ts     # Frontend build config
│   ├── tsconfig.json      # Frontend TypeScript config
│   ├── tailwind.config.js
│   └── postcss.config.mjs
│
├── backend/               # Node.js + Express + PostgreSQL
│   ├── src/
│   │   ├── config/       # Database and app config
│   │   ├── controllers/  # Route controllers
│   │   ├── middleware/   # Auth, CORS, validation
│   │   ├── models/       # Data models (optional)
│   │   ├── routes/       # API route definitions
│   │   │   ├── auth.ts
│   │   │   ├── kpis.ts
│   │   │   ├── tickets.ts
│   │   │   └── users.ts
│   │   └── server.ts     # Express app entry point
│   ├── migrations/       # Database schema and seed data
│   │   ├── 001_init_schema.sql
│   │   ├── 002_sample_data.sql
│   │   ├── combined_migration.sql
│   │   ├── run-simple.js
│   │   ├── run.ts
│   │   └── README.md
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── README.md
│
├── ml-service/           # Python + Flask + Scikit-learn
│   ├── services/        # ML algorithm implementations
│   │   ├── forecasting.py       # Time series forecasting
│   │   ├── workload_optimization.py  # Agent assignment
│   │   ├── diagnostics.py       # Performance analysis
│   │   └── fcr_prediction.py    # First contact resolution
│   ├── app.py           # Flask application
│   ├── requirements.txt
│   ├── Dockerfile
│   └── README.md
│
├── docker-compose.yml   # Local development environment
├── DEPLOYMENT-RENDER.md # Render deployment guide
├── COMPLETE_DEPLOYMENT_GUIDE.md  # Full deployment instructions
├── README-SYSTEM.md     # This file
└── .gitignore
```

## 🗄️ Database Schema

The system uses a comprehensive 18-table PostgreSQL schema:

- **Core Tables**: tickets, users, roles, assignment_groups
- **Lookup Tables**: priority, impact, urgency, status, sub_status
- **Categorization**: category, subcategory, channel, source
- **SLA Management**: sla, configuration_items
- **Analytics**: survey, forecast, ticket_forecast
- **Relationships**: Proper foreign keys and indexes for performance

### Sample Data

Includes 10 sample tickets with realistic ITSM scenarios and proper business logic:
- SLA calculations (24hrs high, 2 days medium, 4 days low priority)
- FCR tracking with reopen/reassignment logic
- Status transitions and sub-status management
- Survey responses for closed tickets

## 🚀 Deployment

### Option 1: Render (Recommended)

1. **Create GitHub repository**:
   ```bash
   # Run the setup script
   ./setup-github.bat  # Windows
   # or
   ./setup-github.sh   # Linux/Mac
   ```

2. **Deploy to Render**:
   - Follow `COMPLETE_DEPLOYMENT_GUIDE.md`
   - PostgreSQL database (~$7/month)
   - Web services for backend and ML (~$7/month each)
   - Static site for frontend (free)

### Option 2: Manual Deployment

- **Frontend**: Vercel, Netlify, or any static hosting
- **Backend**: Heroku, Railway, or VPS
- **Database**: Any PostgreSQL provider
- **ML Service**: Heroku, Railway, or VPS

## 🔧 Development

### Available Scripts

```bash
# Frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build

# Backend
cd backend
npm run dev          # Start with tsx watch
npm run build        # Compile TypeScript
npm run start        # Start production server
npm run migrate      # Run database migrations

# ML Service
cd ml-service
python app.py        # Start Flask development server
```

### Environment Variables

Create `.env` files in each service directory:

**Backend (.env)**:
```env
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-secure-jwt-secret
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

**ML Service (.env)**:
```env
DATABASE_URL=postgresql://user:pass@host:5432/db
FLASK_ENV=development
```

**Frontend (.env)**:
```env
VITE_API_URL=http://localhost:5000
VITE_ML_API_URL=http://localhost:5001
```

## 🤖 ML Models

### Forecasting Model
- **Purpose**: Predict ticket volumes and resolution times
- **Algorithm**: Time series analysis with seasonal decomposition
- **Input**: Historical ticket data, time patterns
- **Output**: Daily/weekly ticket forecasts

### Workload Optimization
- **Purpose**: Optimize agent assignment and capacity planning
- **Algorithm**: Linear programming with constraint optimization
- **Input**: Agent skills, current workload, ticket priorities
- **Output**: Optimal assignment recommendations

### Performance Diagnostics
- **Purpose**: Identify bottlenecks and improvement opportunities
- **Algorithm**: Statistical process control and anomaly detection
- **Input**: KPI metrics, resolution times, customer satisfaction
- **Output**: Performance insights and recommendations

### FCR Prediction
- **Purpose**: Predict first contact resolution probability
- **Algorithm**: Classification model with feature engineering
- **Input**: Ticket attributes, agent experience, category complexity
- **Output**: FCR probability scores

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/profile` - Get user profile

### Tickets
- `GET /api/tickets` - List tickets (with filters)
- `POST /api/tickets` - Create ticket
- `GET /api/tickets/:id` - Get ticket details
- `PUT /api/tickets/:id` - Update ticket
- `DELETE /api/tickets/:id` - Delete ticket

### Analytics
- `GET /api/kpis/summary` - KPI summary
- `GET /api/kpis/trends` - KPI trends over time
- `GET /api/ml/forecast` - Ticket volume forecast
- `POST /api/ml/optimize` - Workload optimization

### Admin
- `GET /api/admin/users` - User management
- `POST /api/admin/migrate` - Run database migrations
- `GET /api/admin/health` - System health check

## 🔒 Security

- **JWT Authentication** with role-based access control
- **Password hashing** with bcrypt
- **CORS protection** for API endpoints
- **Input validation** with express-validator
- **SQL injection protection** with parameterized queries
- **HTTPS enforcement** in production

## 📈 Performance

- **Database indexing** on frequently queried columns
- **Connection pooling** for database efficiency
- **Caching** for ML model predictions
- **Lazy loading** for large datasets
- **Pagination** for API responses

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Use TypeScript for type safety
- Follow ESLint and Prettier configurations
- Write tests for new features
- Update documentation for API changes
- Use conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for academic research in ITSM decision support systems
- Inspired by real-world ITSM challenges and ML applications
- Uses open-source libraries and frameworks

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/work-wise-itsm/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/work-wise-itsm/discussions)
- **Documentation**: See `COMPLETE_DEPLOYMENT_GUIDE.md` for detailed setup

---

**Ready to deploy?** Follow the `COMPLETE_DEPLOYMENT_GUIDE.md` for step-by-step instructions!

### Prerequisites
- Docker & Docker Compose (recommended)
- OR: Node.js 20+, Python 3.11+, PostgreSQL 16+

### Option 1: Docker Compose (Recommended)

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on `localhost:5432`
- Backend on `http://localhost:5000`
- ML Service on `http://localhost:5001`

### Option 2: Local Development

**Terminal 1 - Database:**
```bash
# Create local database (or use Docker image)
createdb workwise_db
```

**Terminal 2 - Backend:**
```bash
cd backend
npm install
cp .env.example .env
# Update .env with database URL
npm run migrate      # Initialize schema
npm run dev         # Start development server
```

**Terminal 3 - ML Service:**
```bash
cd ml-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Update .env with database URL
python app.py
```

**Terminal 4 - Frontend:**
```bash
npm install
npm run dev         # Runs on http://localhost:5173
```

## Environment Configuration

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@localhost:5432/workwise_db
JWT_SECRET=your_secure_secret_key
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### ML Service (.env)
```
DATABASE_URL=postgresql://user:password@localhost:5432/workwise_db
ML_PORT=5001
NODE_ENV=development
BACKEND_API_URL=http://localhost:5000
```

## Database Schema

Key tables:
- **users** - System users with roles (admin, manager, hr, agent)
- **tickets** - ITSM tickets with priority, status, SLA tracking
- **assignment_groups** - Support team groups
- **performance_metrics** - KPI data (resolution time, SLA compliance, FCR rate)
- **workload_distribution** - Per-user ticket load tracking
- **ml_predictions** - Forecasting and diagnostic results

Initialize with:
```bash
cd backend
npm run migrate
```

## API Documentation

### Backend (Node.js)

**Authentication**
- `POST /api/auth/login` - User login, returns JWT token
- `GET /api/auth/me` - Get current user

**Users**
- `GET /api/users` - List all users (admin only)
- `POST /api/users` - Create user (admin only)
- `PUT /api/users/:id` - Update user (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)

**Tickets**
- `GET /api/tickets` - List tickets with filters
- `POST /api/tickets` - Create ticket
- `PUT /api/tickets/:id` - Update ticket

**KPIs**
- `GET /api/kpis/dashboard` - Dashboard metrics
- `GET /api/kpis/team/:groupId` - Team performance

### ML Service (Python)

**Forecasting**
- `POST /api/ml/forecast/tickets` - Predict ticket volume

**Workload**
- `POST /api/ml/workload/balance` - Recommend workload distribution

**Analytics**
- `GET /api/ml/diagnostics/performance` - Performance analysis
- `GET /api/ml/anomalies/detect` - Anomaly detection
- `POST /api/ml/fcr/predict` - FCR risk prediction

## Deployment on Render

### Step 1: Create PostgreSQL Database
1. Go to Render dashboard
2. Create new PostgreSQL database
3. Copy connection string

### Step 2: Deploy Backend
1. Connect GitHub repository
2. Create new Web Service
3. Environment variables:
   ```
   DATABASE_URL=<your_render_postgres_url>
   JWT_SECRET=<generate_secure_key>
   NODE_ENV=production
   FRONTEND_URL=<your_frontend_url>
   ```

### Step 3: Deploy ML Service
1. Create another Web Service
2. Environment variables:
   ```
   DATABASE_URL=<your_render_postgres_url>
   ML_PORT=5001
   NODE_ENV=production
   BACKEND_API_URL=<your_backend_url>
   ```

### Step 4: Deploy Frontend
1. Build with `npm run build`
2. Deploy to Vercel, Netlify, or Render
3. Update FRONTEND_URL and backend API endpoints

## Features

### Dashboard
- Real-time KPI tracking (tickets, resolution time, SLA compliance)
- Team performance visualization
- Workload distribution analysis

### ML-Powered Decision Support
- **Forecasting**: Predict ticket volumes 7+ days ahead
- **Diagnostics**: Identify performance bottlenecks and anomalies
- **Optimization**: Recommend workload balancing and staffing adjustments
- **Risk Prediction**: Identify high-risk FCR cases

### Role-Based Access
- **Admin**: Full system management
- **Manager**: Team monitoring and workload distribution
- **HR**: Resource planning and team performance
- **Agent**: Ticket assignments and dashboards

## Development Roadmap

- [ ] Complete ML model training pipeline
- [ ] Add real-time notifications
- [ ] Implement advanced anomaly detection
- [ ] Add performance benchmarking
- [ ] Create mobile dashboard
- [ ] Add data export functionality
- [ ] Implement audit logging

## Testing

```bash
# Backend tests
cd backend
npm test

# ML service tests
cd ml-service
python -m pytest
```

## Performance Optimization

- Database indexes on frequently queried columns
- API response caching
- Frontend lazy loading and code splitting
- ML model optimization and caching

## Security

- JWT-based authentication
- Role-based access control
- Input validation and sanitization
- SQL injection prevention via parameterized queries
- CORS protection
- Helmet.js security headers

## Documentation

- [Backend Documentation](./backend/README.md)
- [ML Service Documentation](./ml-service/README.md)

## Contributing

1. Create a feature branch
2. Make changes and test thoroughly
3. Submit a pull request

## License

© 2026 Work-Wise Team. All Rights Reserved.

## Support

For issues and questions:
- Check existing GitHub issues
- Open a new issue with detailed description
- Contact project maintainers
