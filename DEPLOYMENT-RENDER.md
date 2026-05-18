# Deployment Guide: Work-Wise on Render

## Overview

This guide covers deploying the Work-Wise ITSM system to Render:
- **PostgreSQL Database** on Render
- **Backend API** (Node.js) on Render
- **ML Service** (Python) on Render  
- **Frontend** (React) on Vercel or Render

## Prerequisites

- Render account (render.com)
- GitHub repository connected to Render
- Domain name (optional)

---

## Step 1: Set Up PostgreSQL Database

### Create Database

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New +** → **PostgreSQL**
3. Fill in:
   - **Name**: `workwise-postgres` (or similar)
   - **Database**: `workwise_db`
   - **User**: `workwise` (or your choice)
   - **Region**: Choose closest to you
   - **PostgreSQL Version**: 16
4. **Create Database**

### Save Connection Details

After creation, save these from the connection string:
```
postgresql://workwise:<PASSWORD>@<HOST>:<PORT>/workwise_db
```

You'll need:
- `<HOST>` - Database host
- `<PASSWORD>` - Auto-generated password
- `<PORT>` - Usually 5432

---

## Step 2: Deploy Backend (Node.js)

### Prepare Repository

Ensure your repo structure matches:
```
repo/
├── backend/
│   ├── src/
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile     # ← Make sure this exists
│   └── Dockerfile.render  # (optional, if needed)
```

### Create Render Web Service

1. Click **New +** → **Web Service**
2. Connect your GitHub repository
3. **Configuration**:
   - **Name**: `workwise-backend`
   - **Region**: Same as database
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

4. **Environment Variables**:
   ```
   DATABASE_URL=postgresql://workwise:<PASSWORD>@<HOST>:5432/workwise_db
   JWT_SECRET=<GENERATE_SECURE_KEY>
   NODE_ENV=production
   FRONTEND_URL=https://your-frontend-url.com
   ```

5. **Create Web Service**

### Initialize Database

After deployment, run migrations:

```bash
# SSH into the service or use curl
curl -X POST https://workwise-backend.onrender.com/api/initialize
```

Or add a startup hook in `package.json`:
```json
{
  "scripts": {
    "migrate": "node dist/migrations/run.js",
    "start": "npm run migrate && node dist/server.js"
  }
}
```

---

## Step 3: Deploy ML Service (Python)

### Prepare Repository

Ensure structure:
```
repo/
├── ml-service/
│   ├── services/
│   ├── app.py
│   ├── requirements.txt
│   ├── Dockerfile       # ← Make sure this exists
```

### Create Render Web Service

1. Click **New +** → **Web Service**
2. Connect your GitHub repository
3. **Configuration**:
   - **Name**: `workwise-ml`
   - **Region**: Same as backend
   - **Root Directory**: `ml-service`
   - **Runtime**: `Docker`
   - **Build Command**: (leave empty, uses Dockerfile)

4. **Environment Variables**:
   ```
   DATABASE_URL=postgresql://workwise:<PASSWORD>@<HOST>:5432/workwise_db
   ML_PORT=10000
   NODE_ENV=production
   BACKEND_API_URL=https://workwise-backend.onrender.com
   ```

   **Note**: Render assigns ports dynamically. Use the port they assign, or set ML_PORT to 10000 (on Render, services run on random ports)

5. **Create Web Service**

---

## Step 4: Deploy Frontend (React)

### Option A: Deploy to Vercel (Recommended)

1. Go to [Vercel](https://vercel.com)
2. Import your GitHub repository
3. **Build Settings**:
   - **Framework**: Vite
   - **Root Directory**: `.` (or leave default)
   - **Build Command**: `npm run build --prefix ./` (adjust path if needed)
   - **Output Directory**: `dist`

4. **Environment Variables**:
   ```
   VITE_API_URL=https://workwise-backend.onrender.com
   ```

5. **Deploy**

### Option B: Deploy to Render

1. Click **New +** → **Web Service**
2. Connect GitHub repository
3. **Configuration**:
   - **Name**: `workwise-frontend`
   - **Root Directory**: `.` (repo root)
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run preview`

4. **Environment Variables**:
   ```
   VITE_API_URL=https://workwise-backend.onrender.com
   ```

5. **Create Web Service**

---

## Step 5: Update Environment Across Services

### Update Backend
Update the `FRONTEND_URL` in backend environment to point to your frontend:
```
FRONTEND_URL=https://your-frontend.vercel.app
```

### Update Frontend
Make sure your API client points to the backend:

In your React code (e.g., `src/utils/api.ts`):
```typescript
const API_URL = process.env.VITE_API_URL || 'http://localhost:5000';

export const api = {
  login: (email: string, password: string) => 
    fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
};
```

---

## Step 6: Domain Setup (Optional)

### Add Custom Domain

1. Go to your service (Backend/Frontend)
2. **Settings** → **Domains**
3. **Add Custom Domain**
4. Point your DNS to Render's provided CNAME

---

## Step 7: Monitoring & Maintenance

### View Logs

Each service shows logs in the Render dashboard. Check for:
- Deployment errors
- Runtime exceptions
- Database connection issues

### Update Services

To deploy new changes:
1. Push to GitHub
2. Render automatically rebuilds and deploys

To trigger manual redeploy:
- Go to service → **Manual Deploy** → **Deploy Latest**

### Environment Variable Updates

1. Service → **Environment**
2. Update variables
3. Changes take effect after next deploy

---

## Troubleshooting

### Database Connection Failed

**Check**:
- `DATABASE_URL` format is correct
- Database is running (check in PostgreSQL service)
- Check firewall/IP allowlist is configured

### API Endpoint Not Responding

**Check**:
- Backend service is running (see logs)
- `FRONTEND_URL` and ML service URLs are correct
- Port numbers match

### ML Service Can't Connect to Backend

**Check**:
- Use full URL: `https://workwise-backend.onrender.com`
- Not `localhost`
- Service names must be fully qualified URLs

### Frontend Can't Connect to API

**Check**:
- `VITE_API_URL` is set and includes `https://`
- CORS is enabled in backend
- Check browser console for errors

---

## Performance Optimization

### Database
- Enable slow query logging
- Create indexes on frequently queried columns (done in migrations)

### Backend & ML Service
- Use production-grade logging
- Monitor memory usage
- Set reasonable timeouts

### Frontend
- Enable gzip compression
- Minify assets
- Use CDN for static files

---

## Security Checklist

- ✅ Generate secure `JWT_SECRET`
- ✅ Use `https://` for all URLs
- ✅ Set `NODE_ENV=production`
- ✅ Enable CORS only for your domain
- ✅ Regularly rotate secrets
- ✅ Keep dependencies updated
- ✅ Use parameterized queries (Node.js `pg` library does this)
- ✅ Validate all user input

---

## Disaster Recovery

### Database Backup

Render provides automatic backups. Access:
1. PostgreSQL service → **Backups**
2. Download or restore from backup

### Rolling Back Deployment

1. Go to service → **Events**
2. Find previous successful deployment
3. Click **Redeploy**

---

## Next Steps

1. **Set up monitoring**: Render → Settings → Notifications
2. **Configure alerts**: Email on deployment failures
3. **Document API endpoints**: Create postman collection
4. **Plan scaling**: Monitor resource usage for future upgrades

---

## Support

- **Render Docs**: https://render.com/docs
- **GitHub**: Check repository for issues
- **Local Testing**: Use `docker-compose up` before deploying

---

**Deployment Complete!** 🎉

Your Work-Wise system is now live on Render.
