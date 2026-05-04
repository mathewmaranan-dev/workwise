# 🚀 Work-Wise Deployment Checklist

## Phase 1: GitHub Setup ✅

- [ ] Create GitHub account (if needed)
- [ ] Create new repository: `work-wise-itsm`
- [ ] Run setup script: `setup-github.bat`
- [ ] Verify repository is public (for Render deployment)
- [ ] Add repository description and topics

## Phase 2: Render PostgreSQL Database ✅

- [ ] Sign up for Render account
- [ ] Create PostgreSQL database service
- [ ] Configure database settings:
  - Name: `workwise-postgres`
  - Database: `workwise_db`
  - User: `workwise`
  - Region: Choose closest
  - Version: PostgreSQL 16
- [ ] Save connection string securely
- [ ] Test database connectivity

## Phase 3: Deploy Backend (Node.js) ✅

- [ ] Create Render Web Service for backend
- [ ] Configure build settings:
  - Root Directory: `backend`
  - Runtime: Node
  - Build Command: `npm install && npm run build`
  - Start Command: `npm start`
- [ ] Add environment variables:
  - `DATABASE_URL` (from PostgreSQL)
  - `JWT_SECRET` (generate secure key)
  - `NODE_ENV=production`
  - `FRONTEND_URL` (placeholder for now)
- [ ] Deploy and verify backend is running
- [ ] Run database migrations via API endpoint

## Phase 4: Deploy ML Service (Python) ✅

- [ ] Create requirements.txt file
- [ ] Create Render Web Service for ML service
- [ ] Configure build settings:
  - Root Directory: `ml-service`
  - Runtime: Python 3
  - Build Command: `pip install -r requirements.txt`
  - Start Command: `gunicorn --bind 0.0.0.0:$PORT app:app`
- [ ] Add environment variables:
  - `DATABASE_URL` (from PostgreSQL)
  - `FLASK_ENV=production`
- [ ] Deploy and verify ML service is running

## Phase 5: Deploy Frontend (React) ✅

- [ ] Choose deployment platform: Render Static Site or Vercel
- [ ] Create static site service
- [ ] Configure build settings:
  - Build Command: `npm install && npm run build`
  - Publish Directory: `dist`
- [ ] Add environment variables:
  - `VITE_API_URL` (backend URL)
  - `VITE_ML_API_URL` (ML service URL)
- [ ] Deploy and verify frontend is accessible

## Phase 6: Connect & Test ✅

- [ ] Update all service URLs in environment variables
- [ ] Test API connectivity from frontend
- [ ] Test ML service integration
- [ ] Verify database connections
- [ ] Test user authentication
- [ ] Test ticket creation and management
- [ ] Verify ML predictions are working

## Phase 7: Production Optimization 🔄

- [ ] Set up custom domain (optional)
- [ ] Configure monitoring and alerts
- [ ] Set up automated backups
- [ ] Optimize performance and costs
- [ ] Add error tracking (Sentry, etc.)
- [ ] Set up CI/CD pipeline
- [ ] Add security headers and HTTPS

## Phase 8: Go Live! 🎉

- [ ] Final end-to-end testing
- [ ] User acceptance testing
- [ ] Performance testing
- [ ] Security audit
- [ ] Documentation updates
- [ ] Team training
- [ ] Official launch announcement

---

## 📊 Service URLs (Fill in as you deploy)

- **GitHub Repository**: https://github.com/yourusername/work-wise-itsm
- **Frontend**: https://workwise-frontend.onrender.com
- **Backend API**: https://workwise-backend.onrender.com
- **ML Service**: https://workwise-ml-service.onrender.com
- **Database**: workwise-postgres.onrender.com (internal)

## 🔑 Important Credentials

- **Render Account**: your-email@domain.com
- **GitHub Account**: your-github-username
- **Database Password**: [SAVE SECURELY - from Render]
- **JWT Secret**: [GENERATE SECURE KEY]

## 🆘 Troubleshooting

If something goes wrong:
1. Check Render service logs
2. Verify environment variables
3. Test database connectivity
4. Check GitHub repository settings
5. Review deployment guide: `COMPLETE_DEPLOYMENT_GUIDE.md`

## 💡 Pro Tips

- Start with Render's free tier for testing
- Use descriptive names for all services
- Save all URLs and credentials securely
- Test each service individually before connecting
- Keep environment variables consistent across services
- Monitor costs as you scale

---

**Status**: ⏳ Ready to start deployment!
**Current Phase**: Phase 1 - GitHub Setup