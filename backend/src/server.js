'use strict';
const { config, assertConfig } = require('./config');

async function main() {
  assertConfig();
  const { store } = require('./storage');
  const report = await store.init();
  if (report.created.length) console.log(`[store] Created missing data files: ${report.created.join(', ')}`);
  const { createApp } = require('./app');
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`Training Institute API listening on http://localhost:${config.port} (${config.env})`);
    console.log(`Allowed CORS origins: ${config.corsOrigins.join(', ')}`);
    console.log(`Data directory: ${config.dataDir}`);
  });
  const shutdown = (signal) => {
    console.log(`${signal} received, closing server...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error(`\n[startup] ${err.message}\n`);
  process.exit(1);
});
