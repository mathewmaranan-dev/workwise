import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { testConnection } from './config/database.js';

// Routes
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import ticketsRoutes from './routes/tickets.js';
import kpisRoutes from './routes/kpis.js';
import lookupsRoutes from './routes/lookups.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ML_PROXY_TIMEOUT_MS = Number(process.env.ML_PROXY_TIMEOUT_MS || 25000);
const ML_PROXY_MAX_RETRIES = Number(process.env.ML_PROXY_MAX_RETRIES || 2);

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
app.use('/api/lookups', lookupsRoutes);

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isTransientProxyError(error: any): boolean {
  const directCode = String(error?.code || '').toUpperCase();
  const causeCode = String(error?.cause?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();

  return (
    directCode === 'ECONNRESET' ||
    directCode === 'ETIMEDOUT' ||
    causeCode === 'UND_ERR_SOCKET' ||
    causeCode === 'ECONNRESET' ||
    causeCode === 'ETIMEDOUT' ||
    message.includes('terminated') ||
    message.includes('socket') ||
    message.includes('aborted')
  );
}

app.use('/api/ml', async (req, res) => {
  try {
    // Forward the original request path to the ML service so that
    // endpoints defined under `/api/ml/...` on the ML service match.
    const mlPath = req.originalUrl || '/';
    const target = new URL(mlPath, ML_SERVICE_URL);
    const requestBody = (req.method === 'GET' || req.method === 'HEAD') ? undefined : JSON.stringify(req.body ?? {});
    let response: Response | null = null;
    let lastError: any = null;

    for (let attempt = 0; attempt <= ML_PROXY_MAX_RETRIES; attempt += 1) {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        const normalized = key.toLowerCase();
        if (HOP_BY_HOP_HEADERS.has(normalized)) {
          continue;
        }
        if (typeof value === 'string') {
          headers.set(key, value);
        } else if (Array.isArray(value)) {
          value.forEach(entry => headers.append(key, entry));
        }
      }

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => {
        console.warn(`⚠️  ML proxy timeout (${ML_PROXY_TIMEOUT_MS}ms) for ${req.method} ${mlPath} - attempt ${attempt + 1}`);
        controller.abort();
      }, ML_PROXY_TIMEOUT_MS);

      try {
        response = await fetch(target.toString(), {
          method: req.method,
          headers,
          body: requestBody,
          signal: controller.signal,
        });
        clearTimeout(timeoutHandle);
        lastError = null;
        break;
      } catch (error: any) {
        clearTimeout(timeoutHandle);
        lastError = error;
        const shouldRetry = attempt < ML_PROXY_MAX_RETRIES && isTransientProxyError(error);
        if (!shouldRetry) {
          break;
        }
        console.debug(`ML proxy error on attempt ${attempt + 1}, retrying...`, { code: error?.code || error?.cause?.code, message: error?.message });
        await delay(150 * (attempt + 1));
      }
    }

    if (!response) {
      throw lastError || new Error('ML proxy request failed with no response');
    }

    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    const content = await response.text();
    res.send(content);
  } catch (error) {
    console.error('ML service proxy error:', error);
    res.status(502).json({
      error: 'Failed to reach ML service',
      code: 'ML_UPSTREAM_UNREACHABLE',
      detail: String((error as any)?.cause?.code || (error as any)?.message || error),
    });
  }
});

// Serve frontend static assets in production only when a built frontend exists
// or when explicitly enabled with SERVE_FRONTEND=true.
const frontendDist = path.resolve(__dirname, '../frontend/dist');
const frontendIndex = path.join(frontendDist, 'index.html');
const hasFrontendBuild = existsSync(frontendIndex);
const serveFrontendEnv = (process.env.SERVE_FRONTEND || '').trim().toLowerCase();
const shouldServeFrontend =
  NODE_ENV === 'production' &&
  (serveFrontendEnv === 'true' || (serveFrontendEnv !== 'false' && hasFrontendBuild));

if (shouldServeFrontend) {
  app.use(express.static(frontendDist));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(frontendIndex);
  });
} else if (NODE_ENV === 'production' && !hasFrontendBuild) {
  console.log('ℹ️ Frontend build not found; backend will run API-only mode.');
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
