import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { testConnection } from './config/database.js';

// Routes
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import ticketsRoutes from './routes/tickets.js';
import kpisRoutes from './routes/kpis.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigin = process.env.FRONTEND_URL?.trim();
    if (!origin) {
      // Allow non-browser requests like curl/postman
      return callback(null, true);
    }
    if (!allowedOrigin || origin === allowedOrigin) {
      return callback(null, true);
    }
    callback(new Error(`CORS block: origin ${origin} not allowed`));
  },
  credentials: true,
  optionsSuccessStatus: 200,
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/kpis', kpisRoutes);

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

app.use('/api/ml', async (req, res) => {
  try {
    const mlPath = req.originalUrl.replace(/^\/api\/ml/, '') || '/';
    const target = new URL(mlPath, ML_SERVICE_URL);
    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        headers.set(key, value);
      } else if (Array.isArray(value)) {
        value.forEach(entry => headers.append(key, entry));
      }
    }

    headers.delete('host');
    headers.delete('connection');
    headers.delete('content-length');

    const response = await fetch(target.toString(), {
      method: req.method,
      headers,
      body: (req.method === 'GET' || req.method === 'HEAD') ? undefined : JSON.stringify(req.body ?? {}),
    });

    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'content-length') {
        res.setHeader(key, value);
      }
    });

    const content = await response.text();
    res.send(content);
  } catch (error) {
    console.error('ML service proxy error:', error);
    res.status(502).json({ error: 'Failed to reach ML service' });
  }
});

// Serve frontend static assets in production
if (NODE_ENV === 'production') {
  const frontendDist = path.resolve(__dirname, '../frontend/dist');
  app.use(express.static(frontendDist));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
async function start() {
  try {
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    app.listen(PORT, () => {
      console.log(`\n🚀 Work-Wise Backend Server running on port ${PORT}`);
      console.log(`📍 Environment: ${NODE_ENV}`);
      console.log(`🗄️  Database: Connected\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
