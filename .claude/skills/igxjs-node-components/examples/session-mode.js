// Minimal SESSION-mode integration: cookie-based SSO with Redis-backed sessions.
// File layout:
//   config/session-manager.js  — singleton (this top half)
//   app.js                     — Express wiring (this bottom half)

// ---- config/session-manager.js ----
import { SessionManager } from '@igxjs/node-components';

export const session = new SessionManager({
  SSO_ENDPOINT_URL: process.env.SSO_ENDPOINT_URL,
  SSO_APP_ID:       process.env.SSO_APP_ID,
  SSO_JWT_SECRET:   process.env.SSO_JWT_SECRET,
  SESSION_SECRET:   process.env.SESSION_SECRET,
  SESSION_AGE:      64800,                    // 18 hours
  REDIS_URL:        process.env.REDIS_URL,    // omit for memory store (dev only)
});

// ---- app.js ----
import express from 'express';
import {
  httpErrorHandler,
  httpNotFoundHandler,
} from '@igxjs/node-components';
// import { session } from './config/session-manager.js';

const app = express();
app.use(express.json());

// IMPORTANT: await before defining routes so session middleware is attached.
await session.setup(app);

// SSO entry points
app.get('/auth/providers', session.identityProviders());
app.get('/auth/callback',  session.callback((user) => ({
  ...user,
  displayName: user.email?.split('@')[0],
  loginTime:   new Date(),
})));

// Refresh and logout
app.post('/auth/refresh', session.authenticate(), session.refresh((user) => ({
  ...user,
  refreshedAt: new Date(),
})));
app.get('/auth/logout', session.logout());

// Protected route — authenticate() verifies, requireUser() loads req.user
app.get('/api/profile',
  session.authenticate(),
  session.requireUser(),
  (req, res) => res.json({ user: req.user }),
);

// Error handlers — last
app.use(httpNotFoundHandler);
app.use(httpErrorHandler);

app.listen(3000);
