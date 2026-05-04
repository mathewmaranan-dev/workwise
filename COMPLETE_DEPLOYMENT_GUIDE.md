# 🚀 Complete Deployment Guide: Work-Wise ITSM System

## Overview

This guide covers deploying your Work-Wise ITSM system with:
- **GitHub Repository** setup with best practices
- **Render PostgreSQL** database
- **Render Backend** (Node.js API)
- **Render ML Service** (Python)
- **Frontend** deployment

---

## 📋 Prerequisites Checklist

- [ ] GitHub account
- [ ] Render account (render.com)
- [ ] Node.js installed locally (for testing)
- [ ] Git installed locally
- [ ] Domain name (optional)

---

## 🎯 Step 1: GitHub Repository Setup

### 1.1 Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click **"New repository"** (green button)
3. Repository details:
   - **Name**: `work-wise-itsm` or `workwise-system`
   - **Description**: `Work-Wise ITSM Decision Support System with ML Forecasting`
   - **Visibility**: Public (for Render deployment) or Private
4. **Don't initialize** with README, .gitignore, or license (we have these)
5. Click **"Create repository"**

### 1.2 Prepare Local Repository

```bash
# Navigate to your project
cd D:\Subjects\template

# Initialize git if not already done
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Work-Wise ITSM system with ML forecasting"

# Connect to GitHub repository
git remote add origin https://github.com/YOUR_USERNAME/work-wise-itsm.git

# Push to GitHub
git push -u origin main
```

### 1.3 GitHub Best Practices

#### Create `.gitignore`
```bash
# Add to .gitignore (if not already present)
node_modules/
.env
.env.local
dist/
*.log
.DS_Store
```

#### Add Essential Files

**README.md** (create if missing):
```markdown
# Work-Wise ITSM System

A comprehensive ITSM decision support system with ML forecasting capabilities.

## Features
- Ticket management with SLA tracking
- ML-powered workload optimization
- Performance diagnostics
- Real-time analytics

## Tech Stack
- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + PostgreSQL
- ML Service: Python + Flask + Scikit-learn
- Deployment: Render + PostgreSQL

## Local Development
```bash
# Install dependencies
npm install
cd backend && npm install
cd ../ml-service && pip install -r requirements.txt

# Start services
docker compose up
```
```

**LICENSE** (optional but recommended):
- Add MIT License via GitHub interface

---

## 🗄️ Step 2: Render PostgreSQL Database

### 2.1 Create Database Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"PostgreSQL"**
3. Configuration:
   - **Name**: `workwise-postgres`
   - **Database**: `workwise_db`
   - **User**: `workwise`
   - **Region**: Choose closest to you (e.g., Oregon, Frankfurt)
   - **PostgreSQL Version**: 16
4. Click **"Create Database"**

### 2.2 Get Connection Details

After creation (takes 2-3 minutes):
1. Go to your database in Render dashboard
2. Copy the **"External Database URL"**:
   ```
   postgresql://workwise:generated_password@host:5432/workwise_db
   ```
3. Save this URL securely - you'll need it for the backend

### 2.3 Database Best Practices

- **Never commit database URLs** to GitHub
- Use Render's environment variables instead
- Database will be accessible at: `your-db-name.onrender.com`

---

## 🔧 Step 3: Deploy Backend (Node.js)

### 3.1 Prepare Backend for Production

#### Update Environment Variables

Create `backend/.env.example`:
```env
DATABASE_URL=postgresql://workwise:password@host:5432/workwise_db
JWT_SECRET=your-super-secure-jwt-secret-here
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.com
PORT=10000
```

#### Update package.json Scripts

Ensure `backend/package.json` has:
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "migrate": "echo 'Migrations run via API endpoint'"
  }
}
```

### 3.2 Create Render Web Service

1. In Render dashboard, click **"New +"** → **"Web Service"**
2. **Connect Repository**:
   - Link your GitHub repository
   - Branch: `main`
3. **Configuration**:
   - **Name**: `workwise-backend`
   - **Region**: Same as database
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

4. **Environment Variables** (add these):
   ```
   DATABASE_URL=postgresql://workwise:your_password@host:5432/workwise_db
   JWT_SECRET=generate-a-secure-random-string-here
   NODE_ENV=production
   FRONTEND_URL=https://workwise-frontend.onrender.com
   ```

5. Click **"Create Web Service"**

### 3.3 Initialize Database

After deployment succeeds:
1. Go to your backend service URL
2. Run database migrations via API:
   ```bash
   curl -X POST https://workwise-backend.onrender.com/api/admin/migrate
   ```
   Or visit: `https://workwise-backend.onrender.com/api/admin/migrate`

---

## 🧠 Step 4: Deploy ML Service (Python)

### 4.1 Prepare ML Service

#### Create requirements.txt
```txt
Flask==2.3.3
Flask-CORS==4.0.0
psycopg2-binary==2.9.7
scikit-learn==1.3.0
pandas==2.0.3
numpy==1.24.3
joblib==1.3.2
python-dotenv==1.0.0
gunicorn==21.2.0
```

#### Update app.py for Production
```python
# Add at top of ml-service/app.py
import os
from dotenv import load_dotenv

load_dotenv()

# Update database connection
DATABASE_URL = os.getenv('DATABASE_URL')
```

### 4.2 Create Render Web Service

1. Click **"New +"** → **"Web Service"**
2. **Configuration**:
   - **Name**: `workwise-ml-service`
   - **Root Directory**: `ml-service`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn --bind 0.0.0.0:$PORT app:app`

3. **Environment Variables**:
   ```
   DATABASE_URL=postgresql://workwise:password@host:5432/workwise_db
   FLASK_ENV=production
   ```

4. **Create Web Service**

---

## 🎨 Step 5: Deploy Frontend (React)

### 5.1 Option A: Deploy on Render

1. Click **"New +"** → **"Static Site"**
2. **Configuration**:
   - **Name**: `workwise-frontend`
   - **Root Directory**: (leave empty - root)
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

3. **Environment Variables**:
   ```
   VITE_API_URL=https://workwise-backend.onrender.com
   VITE_ML_API_URL=https://workwise-ml-service.onrender.com
   ```

### 5.2 Option B: Deploy on Vercel (Recommended for React)

1. Go to [Vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"New Project"**
3. Import your GitHub repository
4. **Configure**:
   - **Framework Preset**: Vite
   - **Root Directory**: (leave empty)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

5. **Environment Variables**:
   ```
   VITE_API_URL=https://workwise-backend.onrender.com
   VITE_ML_API_URL=https://workwise-ml-service.onrender.com
   ```

---

## 🔗 Step 6: Connect Services

### 6.1 Update API URLs

After all services are deployed, update the frontend environment variables:

**For Render Static Site:**
```
VITE_API_URL=https://workwise-backend.onrender.com
VITE_ML_API_URL=https://workwise-ml-service.onrender.com
```

**For Vercel:**
Add in Vercel dashboard under "Environment Variables"

### 6.2 Test Connections

1. **Backend Health Check**:
   ```bash
   curl https://workwise-backend.onrender.com/health
   ```

2. **ML Service Health Check**:
   ```bash
   curl https://workwise-ml-service.onrender.com/health
   ```

3. **Frontend Access**:
   - Visit your frontend URL
   - Try logging in with test credentials

---

## 🛡️ Security Best Practices

### Environment Variables
- **Never commit** `.env` files to GitHub
- Use **strong, unique** JWT secrets
- Rotate database passwords regularly

### Database Security
- Use Render's **managed PostgreSQL** (automatic backups)
- Enable **database backups** in Render
- Restrict database access to your services only

### API Security
- Enable **CORS** properly
- Use **HTTPS** everywhere
- Implement **rate limiting** for production

---

## 📊 Monitoring & Maintenance

### Render Monitoring
- Check **service logs** in Render dashboard
- Monitor **response times** and errors
- Set up **health checks**

### Database Monitoring
- Monitor **connection counts**
- Check **query performance**
- Set up **automated backups**

### Updates & Deployment
```bash
# Update process
git add .
git commit -m "Update: [description]"
git push origin main

# Render auto-deploys from main branch
```

---

## 🚨 Troubleshooting

### Common Issues

**Database Connection Failed:**
- Check DATABASE_URL format
- Verify database is running
- Check firewall settings

**Build Failed:**
- Check build logs in Render
- Verify package.json scripts
- Check Node.js/Python versions

**CORS Errors:**
- Update FRONTEND_URL in backend
- Check CORS configuration

**ML Service Not Responding:**
- Check Python dependencies
- Verify DATABASE_URL in ML service
- Check Flask port configuration

---

## 💡 Pro Tips

1. **Use Render's free tier** for development/testing
2. **Set up automated deployments** from GitHub
3. **Use environment-specific** configurations
4. **Monitor costs** as you scale
5. **Set up alerts** for service downtime
6. **Use Render's preview deployments** for testing

---

## 🎉 You're Done!

Your Work-Wise ITSM system is now live on:
- **Frontend**: https://workwise-frontend.onrender.com
- **Backend API**: https://workwise-backend.onrender.com
- **ML Service**: https://workwise-ml-service.onrender.com
- **Database**: Managed PostgreSQL on Render

**Next Steps:**
1. Test all features end-to-end
2. Set up monitoring alerts
3. Configure custom domain (optional)
4. Train ML models with real data
5. Add user authentication and roles

Need help with any step? Check the logs in Render dashboard or ask for assistance!