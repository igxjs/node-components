// Minimal TOKEN-mode integration: JWT bearer tokens stored in Redis,
// suitable for SPAs / mobile / public APIs.
//
// Differences vs SESSION mode:
//   - SESSION_MODE: SessionMode.TOKEN
//   - REDIS_URL is required (no memory fallback)
//   - SSO_SUCCESS_URL / SSO_FAILURE_URL are required
//   - callback() returns an HTML page that writes the token to localStorage,
//     keyed by SESSION_KEY (default 'session_token')

// ---- config/session-manager.js ----
import { SessionManager, SessionMode } from '@igxjs/node-components';

export const session = new SessionManager({
  SSO_ENDPOINT_URL:  process.env.SSO_ENDPOINT_URL,
  SSO_APP_ID:        process.env.SSO_APP_ID,
  SSO_JWT_SECRET:    process.env.SSO_JWT_SECRET,
  SSO_SUCCESS_URL:   '/dashboard',
  SSO_FAILURE_URL:   '/login',
  SESSION_MODE:      SessionMode.TOKEN,
  SESSION_SECRET:    process.env.SESSION_SECRET,
  SESSION_AGE:       64800,
  SESSION_KEY:       'session_token',         // localStorage key + Redis key prefix
  SESSION_EXPIRY_KEY:'session_expires_at',    // localStorage key for expiry
  REDIS_URL:         process.env.REDIS_URL,   // required
});

// ---- app.js ----
import express from 'express';
import { httpErrorHandler, httpNotFoundHandler } from '@igxjs/node-components';
// import { session } from './config/session-manager.js';

const app = express();
app.use(express.json());

await session.setup(app);

// Optional query override: /auth/providers?app_id=tenant-a
app.get('/auth/providers', session.identityProviders());

// Callback returns an HTML page that stores token + expiry in localStorage,
// then redirects to SSO_SUCCESS_URL.
app.get('/auth/callback', session.callback((user) => ({
  ...user,
  displayName: user.email?.split('@')[0],
})));

// Client must send `Authorization: Bearer ${localStorage.getItem('session_token')}`
app.get('/api/profile',
  session.authenticate(),
  session.requireUser(),
  (req, res) => res.json({ user: req.user }),
);

app.post('/api/auth/refresh',
  session.authenticate(),
  // Optional query override: /api/auth/refresh?app_id=tenant-a
  session.refresh((user) => ({ ...user, refreshedAt: new Date() })),
);

// Logout current device, or `?all=true` for all devices
app.post('/api/auth/logout', session.authenticate(), session.logout());

app.use(httpNotFoundHandler);
app.use(httpErrorHandler);

app.listen(3000);
