'use strict';
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { config } = require('./config');
const routes = require('./routes');
const requestLogger = require('./middleware/requestLogger');
const { apiLimiter } = require('./middleware/rateLimiters');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Allow same-origin / non-browser clients (no Origin header) and the configured frontend origins.
        if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Disposition'],
      maxAge: 600,
    })
  );
  app.use(express.json({ limit: config.bodyLimit }));
  if (!config.isTest) app.use(requestLogger);
  app.use('/api', apiLimiter, routes);
  app.get('/', (req, res) => res.json({ success: true, data: { name: 'Training Institute API', docs: '/api/docs', health: '/api/health' } }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
