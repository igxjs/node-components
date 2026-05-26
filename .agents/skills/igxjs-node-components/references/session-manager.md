# SessionManager Integration Reference

## Two modes, one API

`SessionManager` exposes the same method names regardless of mode; behavior switches on `SESSION_MODE`:

| Aspect | SESSION (default) | TOKEN |
|--------|-------------------|-------|
| Auth carrier | session cookie (express-session) | `Authorization: Bearer {jwt}` |
| Storage backing | session store (Redis or in-memory) | Redis (required) |
| Multi-device | one session per cookie | one token per device, identified by `tid` |
| `callback()` returns | redirect | HTML page that writes token + expiry to `localStorage`, then redirects |
| `logout()?all=true` | n/a | invalidates all tokens for the user |
| CSRF risk | yes (cookie) | no |
| XSS exposure | session cookie can be HttpOnly | token in `localStorage` is exposed |

`SessionMode.SESSION === 'session'`, `SessionMode.TOKEN === 'token'`.

## Required vs optional config

| Key | SESSION | TOKEN | Notes |
|-----|---------|-------|-------|
| `SSO_ENDPOINT_URL` | required | required | base URL of IdP microservice |
| `SSO_APP_ID` | required | required | |
| `SSO_JWT_SECRET` | required | required | secret for SSO JWT verification |
| `SSO_SUCCESS_URL` | optional | required | redirect after successful login |
| `SSO_FAILURE_URL` | optional | required | redirect after failed login |
| `SESSION_SECRET` | required | required | encrypts cookies / stored tokens |
| `REDIS_URL` | optional (memory fallback) | required | TOKEN mode has no memory fallback |
| `SESSION_MODE` | omit or `SessionMode.SESSION` | `SessionMode.TOKEN` | |
| `SESSION_AGE` | optional, default `64800` | optional, default `64800` | seconds |
| `SESSION_KEY` | optional, default `'session_token'` | optional, default `'session_token'` | session storage key (SESSION) / localStorage key + Redis token key prefix (TOKEN) |
| `SESSION_EXPIRY_KEY` | n/a | optional, default `'session_expires_at'` | localStorage key for expiry timestamp |
| `SESSION_PREFIX` | optional, default `'ibmid:'` | optional, default `'ibmid:'` | Prefix for express-session Redis store keys; TOKEN-mode token keys do not use this prefix |
| `TOKEN_STORAGE_TEMPLATE_PATH` | n/a | optional | custom HTML template path; supports `{{SESSION_DATA_KEY}}`, `{{SESSION_DATA_VALUE}}`, `{{SESSION_EXPIRY_KEY}}`, `{{SESSION_EXPIRY_VALUE}}`, `{{SSO_SUCCESS_URL}}`, `{{SSO_FAILURE_URL}}` |

## Lifecycle

```
1.  new SessionManager(config)         // construct singleton
2.  await session.setup(app)           // attaches express-session, opens Redis
3.  app.get('/auth/providers', session.identityProviders())
4.  client/browser redirects to the selected provider.url returned by /auth/providers
5.  app.get('/auth/callback', session.callback(initUser))
6.  app.use(/* protected */, session.authenticate(), session.requireUser())
7.  app.post('/auth/refresh', session.authenticate(), session.refresh(initUser))
8.  app.post('/auth/logout', session.authenticate(), session.logout())
```

## Method semantics

### `setup(app)` — async, must `await`
Registers `express-session` (SESSION mode) and stores client setup; opens Redis if `REDIS_URL` is set. Routes registered before the await resolves will not see session middleware.

### `authenticate(errorRedirectUrl?)`
- SESSION: checks `req.session[SESSION_KEY]` exists and `authorized === true`
- TOKEN: validates `Authorization: Bearer {jwt}` (lightweight — no Redis lookup)
- Does **not** populate `req.user`. Pair with `requireUser()` if the handler needs the user.
- On failure: redirect to `errorRedirectUrl` if provided, else throw `CustomError(401)`.

### `requireUser()`
- Loads full user data and assigns to `req.user`.
- SESSION: copies from session store.
- TOKEN: fetches from Redis using the token's `tid` and email.
- Always use **after** `authenticate()` (or `verifySession()`/`verifyToken()`).

### `verifySession(errorRedirectUrl?)` / `verifyToken(errorRedirectUrl?)`
Force a specific verification regardless of `SESSION_MODE`. Useful for endpoints that must accept only one auth carrier (e.g., a token-only refresh endpoint in a hybrid app).

### `callback(initUser)`
Consumer-side callback handler. The IdP redirects back to this route with `?jwt=...`; `SessionManager` decrypts that JWT locally and then calls `initUser`, a synchronous transform `(user: SessionUser) => SessionUser` you can use to add fields like `displayName` or `loginTime`.
- SESSION: writes `req.session[SESSION_KEY] = transformedUser`, then redirects to `payload.redirect_url || SSO_SUCCESS_URL`.
- TOKEN: encrypts a JWT, stores user in Redis at `{SESSION_KEY}:{email}:{tid}`, returns an HTML page that writes the token to `localStorage[SESSION_KEY]` and the expiry to `localStorage[SESSION_EXPIRY_KEY]`, then redirects to `payload.redirect_url || SSO_SUCCESS_URL`.

### `refresh(initUser)`
Renews the session/token by calling the IdP's `POST /auth/refresh?app_id=...` and re-running `initUser`. The `app_id` query value comes from `req.query.app_id` and falls back to `SSO_APP_ID`. Acquires a 60-second in-memory lock per email via `lock()` to prevent concurrent refresh races. TOKEN mode reuses the same `tid`, overwrites the same Redis user-data key, and returns a newly encrypted bearer token; it does not delete a separate old-token key during refresh.

### `logout()`
Reads query params:
- `?redirect=true` — redirect to `SSO_SUCCESS_URL`/`SSO_FAILURE_URL` after logout.
- `?all=true` (TOKEN mode only) — delete all `{SESSION_KEY}:{email}:*` keys.

### `getUser(req, includeUserData)` — utility, not middleware
For custom flows. Throws `CustomError(401)` if not authenticated. `includeUserData` toggles whether to fetch from session/Redis vs. return only the auth payload.

### `identityProviders()`
Proxy to `GET {SSO_ENDPOINT_URL}/auth/providers?app_id=...`. The `app_id` query value comes from `req.query.app_id` and falls back to `SSO_APP_ID`. Use it to render a login button list, including multi-tenant/provider-selector screens. Each returned provider includes the login `url`; redirect the browser/client to that URL to start login.

There is no public `SessionManager.login()` middleware. Do not add a custom Express route that calls Axios `POST /auth/login/:idp`; it bypasses the `identityProviders()` contract and can lose the request-level `app_id` selection.

## Redis key patterns (TOKEN mode)

```
{SESSION_KEY}:{email}:{tid}     → JSON.stringify(user), TTL = SESSION_AGE seconds
```

Refresh locks are held in the `SessionManager` instance's in-memory `Map`, not Redis. Keep `SessionManager` as a singleton so those locks are shared across routes in the process.

## Singleton pattern

```javascript
// config/session-manager.js
import { SessionManager, SessionMode } from '@igxjs/node-components';

export const session = new SessionManager({
  SSO_ENDPOINT_URL: process.env.SSO_ENDPOINT_URL,
  SSO_APP_ID:       process.env.SSO_APP_ID,
  SSO_JWT_SECRET:   process.env.SSO_JWT_SECRET,
  SESSION_SECRET:   process.env.SESSION_SECRET,
  REDIS_URL:        process.env.REDIS_URL,
});
```

Reasons: Redis connection pool sharing, in-process refresh lock map consistency, and middleware identity (multiple instances mean multiple session middlewares).

## Error handling

`SessionManager` throws `CustomError`:

| Code | When |
|------|------|
| 400 | Invalid JWT payload from IdP |
| 401 | Missing / invalid / expired token or session; specifically detects `ERR_JWT_EXPIRED` |
| 403 | Authenticated but `authorized === false` |
| 409 | Refresh lock active |
| 500 | Redis connection failure or unexpected error |

Add `httpErrorHandler` last in the middleware chain to render these uniformly.

## Migrating SESSION → TOKEN

1. Add `SESSION_MODE`, `SSO_SUCCESS_URL`, `SSO_FAILURE_URL`, `REDIS_URL` to config.
2. Update client code: replace cookie-based fetch with `Authorization: Bearer ${localStorage.getItem(SESSION_KEY)}`.
3. Switch logout cleanup to `localStorage.removeItem(SESSION_KEY)` + `localStorage.removeItem(SESSION_EXPIRY_KEY)`.
4. Test refresh flow and multi-device logout (`?all=true`).
