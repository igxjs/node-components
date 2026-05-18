// End-to-end integration: SessionManager (TOKEN mode) + FlexRouter +
// httpErrorHandler + Logger. Demonstrates how the components compose.

import express, { Router } from 'express';
import {
  SessionManager,
  SessionMode,
  FlexRouter,
  Logger,
  httpCodes,
  httpError,
  httpErrorHandler,
  httpNotFoundHandler,
  httpHelper,
} from '@igxjs/node-components';

const logger = Logger.getInstance('App');

// ---- session singleton ----
const session = new SessionManager({
  SSO_ENDPOINT_URL: process.env.SSO_ENDPOINT_URL,
  SSO_APP_ID:       process.env.SSO_APP_ID,
  SSO_JWT_SECRET:   process.env.SSO_JWT_SECRET,
  SSO_SUCCESS_URL:  '/dashboard',
  SSO_FAILURE_URL:  '/login',
  SESSION_MODE:     SessionMode.TOKEN,
  SESSION_SECRET:   process.env.SESSION_SECRET,
  REDIS_URL:        process.env.REDIS_URL,
});

// ---- feature routers ----
const publicRouter = Router();
publicRouter.get('/health', (_req, res) => res.json({ ok: true }));

const userRouter = Router();
userRouter.get('/me', (req, res) => res.json({ user: req.user }));
userRouter.get('/upstream', async (_req, res, next) => {
  try {
    // Example of converting an Axios failure into a CustomError
    const axios = (await import('axios')).default;
    const r = await axios.get('https://upstream.example.com/data');
    res.json(r.data);
  } catch (e) {
    next(httpHelper.handleAxiosError(e, 'Upstream failed'));
  }
});

userRouter.get('/admin', (req, res, next) => {
  if (!req.user?.attributes?.groups?.includes('admin')) {
    return next(httpError(httpCodes.FORBIDDEN, 'Admin access required'));
  }
  res.json({ secret: 42 });
});

// ---- app wiring ----
const app = express();
app.use(express.json());

await session.setup(app);

// Auth endpoints
app.get('/auth/providers', session.identityProviders());
app.get('/auth/callback',  session.callback((u) => u));
app.post('/auth/refresh',  session.authenticate(), session.refresh((u) => u));
app.post('/auth/logout',   session.authenticate(), session.logout());

// Public + private routers via FlexRouter
new FlexRouter('/api/v1/public', publicRouter).mount(app, '');
new FlexRouter('/api/v1/users', userRouter, [
  session.authenticate(),
  session.requireUser(),
]).mount(app, '');

// Error handlers — must be last
app.use(httpNotFoundHandler);
app.use(httpErrorHandler);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => logger.info('listening on', port));
