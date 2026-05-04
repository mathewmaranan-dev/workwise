# Work-Wise Backend API

Node.js + Express + PostgreSQL backend for the Work-Wise ITSM Decision Support System.

## Quick Start

### Setup

```bash
cd backend
npm install
```

### Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Update `.env` with your database credentials:
```
DATABASE_URL=postgresql://user:password@localhost:5432/workwise_db
JWT_SECRET=your_secret_key
PORT=5000
```

### Development

```bash
npm run dev
```

Server will run on `http://localhost:5000`

### Build for Production

```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - List all users (admin only)
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create user (admin only)
- `PUT /api/users/:id` - Update user (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)

### Tickets
- `GET /api/tickets` - List tickets with filters
- `GET /api/tickets/:id` - Get ticket by ID
- `POST /api/tickets` - Create ticket
- `PUT /api/tickets/:id` - Update ticket

### KPIs
- `GET /api/kpis/dashboard` - Dashboard metrics
- `GET /api/kpis/team/:groupId` - Team performance

## Deployment on Render

1. Create a new PostgreSQL database on Render
2. Create a new Web Service on Render
3. Set environment variables:
   - `DATABASE_URL`: Your Render PostgreSQL connection string
   - `JWT_SECRET`: Your JWT secret key
   - `NODE_ENV`: production

## Project Structure

```
backend/
├── src/
│   ├── config/        # Database configuration
│   ├── controllers/   # Business logic
│   ├── middleware/    # Auth and other middleware
│   ├── models/        # Data models
│   ├── routes/        # API routes
│   └── server.ts      # Server entry point
├── package.json
├── tsconfig.json
└── .env.example
```

## Next Steps

1. Generate database schema
2. Create migration system
3. Integrate Python ML service
4. Add testing framework
5. Deploy to Render
