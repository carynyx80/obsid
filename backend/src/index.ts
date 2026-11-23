import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { seedDemo } from './seed.js';
import { createStore } from './store/index.js';

async function main() {
  const config = loadConfig();
  const store = createStore(config);
  await store.init();
  console.log(`[obsid] store: ${store.kind}${store.kind === 'memory' ? ' (data is lost on restart; set DATABASE_URL for Postgres)' : ''}`);

  if (config.seedDemo && (await seedDemo(store))) console.log('[obsid] seeded demo data');

  const purge = setInterval(() => store.purgeExpiredNonces().catch((e) => console.error('[obsid] nonce purge failed', e)), 5 * 60 * 1000);
  purge.unref();

  const app = createApp(store, config);
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[obsid] listening on :${config.port}`);
  });

  const shutdown = (signal: string) => {
    console.log(`[obsid] ${signal} received, shutting down`);
    clearInterval(purge);
    server.close(() => {
      store.close().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((e) => {
  console.error('[obsid] failed to start', e);
  process.exit(1);
});
