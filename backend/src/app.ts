import cors from 'cors';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { buildSignInMessage, newNonce, parseAddress, requireAuth } from './auth.js';
import type { Config } from './config.js';
import { errorHandler, HttpError, notFound } from './http.js';
import { adminRouter } from './routes/admin.js';
import { hostRouter } from './routes/host.js';
import { publicRouter } from './routes/public.js';
import type { Store } from './store/types.js';

/**
 * Privacy: there is intentionally no request logger and no buyer-facing write endpoint.
 * The rate limiter keeps per-IP counters in process memory only for its window; nothing is persisted.
 */
export function createApp(store: Store, config: Config): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy); // Railway sits behind one proxy hop.

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin.replace(/\/+$/, ''))),
      methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['content-type', 'x-address', 'x-signature', 'x-nonce'],
      maxAge: 600,
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use(express.json({ limit: config.bodyLimit }));
  app.use(
    '/api',
    rateLimit({ windowMs: 15 * 60 * 1000, limit: config.rateLimitMax, standardHeaders: 'draft-7', legacyHeaders: false }),
  );

  const nonceLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: config.nonceRateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'too many nonce requests, slow down' },
  });

  app.get('/api/auth/nonce', nonceLimiter, async (req, res) => {
    const address = parseAddress(req.query.address);
    if (!address) throw new HttpError(400, 'valid address query parameter required');
    const nonce = newNonce();
    const expiresAt = new Date(Date.now() + config.nonceTtlMs);
    await store.createNonce({ nonce, address: address.toLowerCase(), expiresAt });
    res.set('cache-control', 'no-store').json({ nonce, message: buildSignInMessage(address, nonce), expiresAt: expiresAt.toISOString() });
  });

  const auth = requireAuth(store, config);
  app.use('/api/admin', adminRouter(store, auth));
  app.use('/api', hostRouter(store, auth));
  app.use('/api', publicRouter(store));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
