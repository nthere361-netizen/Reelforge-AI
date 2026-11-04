import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/error.js';
import { healthLimiter } from './middleware/rateLimit.js';

import { meRouter } from './routes/me.js';
import { sourcesRouter } from './routes/sources.js';
import { projectsRouter } from './routes/projects.js';
import { scenesRouter } from './routes/scenes.js';
import { mediaRouter } from './routes/media.js';
import { exportsRouter } from './routes/exports.js';

export const app = express();

// Security headers (relaxed for local media & blob playback)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Robust multi-origin CORS configuration
const allowedOrigins = [
  env.CLIENT_ORIGIN,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com') || origin.endsWith('.railway.app')) {
        return callback(null, true);
      }
      return callback(null, true); // Dev-friendly permissive CORS
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Disposition'],
  })
);

// Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Logging
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/api/v1/health',
    },
  })
);

// Public health check route
app.get('/api/v1/health', healthLimiter, (_req, res) => {
  res.status(200).json({
    data: {
      status: 'ok',
      service: 'ReelForge AI API',
      timestamp: new Date().toISOString(),
      models: {
        text: env.GEMINI_TEXT_MODEL,
        tts: env.GEMINI_TTS_MODEL,
        image: env.GEMINI_IMAGE_MODEL,
      },
    },
    error: null,
  });
});

// Mounted API v1 routers
app.use('/api/v1/me', meRouter);
app.use('/api/v1/sources', sourcesRouter);
app.use('/api/v1/projects', projectsRouter);
app.use('/api/v1/projects', mediaRouter);
app.use('/api/v1/projects', exportsRouter);
app.use('/api/v1/scenes', scenesRouter);

// Central error handler
app.use(errorHandler);
