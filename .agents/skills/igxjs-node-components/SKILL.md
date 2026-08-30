---
name: igxjs-node-components
description: Use this skill whenever the user wants to integrate, debug, migrate, or configure @igxjs/node-components in an Express.js app, including SSO with SessionManager, SESSION vs TOKEN mode, request-level app_id handling, FlexRouter, JwtManager/JWE encryption, RedisManager, Logger, or httpErrorHandler/httpError/CustomError. Also use it for fixing existing node-components integrations, migrating SESSION to TOKEN, wiring auth providers/refresh/logout/callback routes, or explaining the Identity Provider microservice contract.
---

# Integrating @igxjs/node-components

`@igxjs/node-components` is a shared Express.js component library exposing six building blocks: `SessionManager`, `FlexRouter`, `JwtManager`, `RedisManager`, `Logger`, and a set of HTTP error handlers (`httpError`, `httpErrorHandler`, `httpNotFoundHandler`, `httpCodes`, `CustomError`, `httpHelper`). This skill covers integrating these components into a downstream Express application.

## When to Apply This Skill

Apply when integrating into a target Express project that needs any of:
- SSO authentication (cookie sessions or JWT bearer tokens) via an Identity Provider microservice
- Mounting routers under context paths with shared middleware
- Encrypting/decrypting JWT (JWE) tokens for non-SSO flows
- Connecting to Redis with TLS support
- Standardized HTTP error handling with `CustomError`
- A zero-dependency, color-aware logger

This skill is for **consumers** of the library, not for modifying the library itself.

## Package Facts (Verify Before Recommending)

- Package name: `@igxjs/node-components`
- Registry: GitHub Packages (`https://npm.pkg.github.com`) — installation requires authenticating with that registry
- Module type: ESM-only build (`"type": "module"` in package.json). The package source uses `export` and ships no CommonJS bundle.
- Engines: Node.js >= 22 (`connect-redis` v10 sets this runtime floor)
- Peer dep: `express` ^4 || ^5 (consumer must install)
- TypeScript types are bundled via `index.d.ts`

### How consumers import it

The package has no top-level `await`, so all three import styles work — pick by consumer project type:

| Consumer project | Import style | Notes |
|------------------|--------------|-------|
| ESM on Node ≥ 22 (`"type": "module"` or `.mjs`) | `import { SessionManager } from '@igxjs/node-components'` | Recommended; matches the package's native shape. |
| CommonJS on Node ≥ 22.12 | `const { SessionManager } = require('@igxjs/node-components')` | Works because Node 22.12+ stably supports `require()` loading ESM packages that have no top-level await. No flag needed. |
| CommonJS on Node 22.0–22.11 | `const { SessionManager } = await import('@igxjs/node-components')` | Use dynamic import inside an `async` function. Synchronous `require()` will throw `ERR_REQUIRE_ESM`. |

Node versions below 22 are unsupported. Check `node -v` or `engines` in the consumer's `package.json` before installing or recommending an import style.

The full public API surface is enumerated in [references/api-surface.md](references/api-surface.md). Consult it before recommending an export or method.

## Installation Workflow

1. Confirm the consumer project authenticates to GitHub Packages for the `@igxjs` scope. If not, instruct the user to add to `.npmrc`:
   ```
   @igxjs:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
   ```
2. Confirm the consumer runs Node ≥ 22; upgrade Node first if it does not.
3. Install: `npm install @igxjs/node-components express`
4. Pick the import style based on the consumer's project — see the table above. ESM consumers use `import`; CJS consumers on Node ≥ 22.12 can use `require()` directly; CJS consumers on Node 22.0–22.11 need dynamic `import()`.

## Component Selection Map

Pick the component(s) the user needs and read the matching reference file before writing code:

| User goal | Component | Reference |
|-----------|-----------|-----------|
| SSO login + protected routes (cookie) | `SessionManager` (SESSION mode) | [references/session-manager.md](references/session-manager.md) |
| SSO login + protected routes (SPA / mobile / API) | `SessionManager` (TOKEN mode) | [references/session-manager.md](references/session-manager.md) |
| Mount one or more `express.Router()` instances with router-specific context paths and middleware | `FlexRouter` | [references/flex-router.md](references/flex-router.md) |
| Encrypt/decrypt JWE tokens (not SSO) | `JwtManager` | [references/jwt-manager.md](references/jwt-manager.md) |
| Direct Redis access with TLS / reconnection | `RedisManager` | [references/redis-manager.md](references/redis-manager.md) |
| 404 + standardized error responses | `httpError*`, `CustomError`, `httpCodes`, `httpHelper` | [references/http-handlers.md](references/http-handlers.md) |
| Component-prefixed colorful logs | `Logger` | [references/logger.md](references/logger.md) |

## Critical Integration Rules

These rules are non-obvious from reading the API surface alone — apply them whenever they're relevant.

### Naming convention is strict

`SessionManager` and `JwtManager` constructors require **UPPERCASE keys with `JWT_`/`SESSION_`/`SSO_`/`REDIS_` prefixes** (e.g., `SSO_ENDPOINT_URL`, `SESSION_SECRET`, `JWT_EXPIRATION_TIME`). Per-call options on `JwtManager.encrypt()` and `decrypt()` use **camelCase** (e.g., `expirationTime`, `issuer`). Mixing them silently ignores values.

### `SessionManager` must be a singleton

Instantiate once, export, and import elsewhere. Multiple instances exhaust Redis connections and split session state. Always recommend `config/session-manager.js` (or equivalent) as the single source.

### `setup()` is async — `await` it before any route definitions

```javascript
await session.setup(app);     // initializes session middleware + Redis
app.get('/protected', session.authenticate(), session.requireUser(), handler);
```

Routes registered before `setup()` resolves will not have session middleware attached.

### `FlexRouter` wraps one Express router at a time

Follow `components/router.js`: create an `express.Router()`, define routes on it, then create one `new FlexRouter(context, router, handlers?)` for that exact router. If a module has separate public and protected routers, export two `FlexRouter` entries. Do not use one `FlexRouter` as an aggregate for multiple Express routers, and do not put public and protected routes into the same Express router when they need different middleware.

`mount(app, basePath)` concatenates `basePath + context`. Prefer putting shared prefixes such as `/api/v1` in `basePath`, and keep each `FlexRouter` context focused on the router-specific path such as `/public` or `/protected`. Pass an empty `basePath` only when there is intentionally no shared prefix.

```javascript
// features/api/routes.js
const publicRouter = Router();
const privateRouter = Router();

publicRouter.get('/health', healthHandler);
privateRouter.get('/me', profileHandler);

export const routers = [
  new FlexRouter('/public', publicRouter),
  new FlexRouter('/protected', privateRouter, [
    session.authenticate(),
    session.requireUser(),
  ]),
];

// app.js
for (const router of routers) {
  router.mount(app, '/api/v1');
}
```

For CommonJS route modules in environments that can load the package synchronously, use the same one-`FlexRouter`-per-`express.Router()` shape with `module.exports = { routers: [...] }`. If the consumer is CommonJS on Node 22.0-22.11, follow the import guidance above and create the routers after the dynamic `import('@igxjs/node-components')` resolves.

### `authenticate()` and `requireUser()` are separate steps

`authenticate()` verifies the session/token; it does **not** populate `req.user`. `requireUser()` loads user data into `req.user`; it is not a replacement authorization check. For protected handlers that need `req.user`, use `authenticate()` first, then `requireUser()`.

In SESSION mode, `requireUser()` simply copies `req.session[SESSION_KEY]` and does not check `authorized === true`, so do not put it before `authenticate()` as the authorization gate. In TOKEN mode, `requireUser()` also validates the bearer token and fetches Redis user data; running it before `authenticate()` works but does extra work before the lightweight auth check.

### TOKEN mode requires Redis and the two redirect URLs

If `SESSION_MODE: SessionMode.TOKEN`, the consumer must set `REDIS_URL`, `SSO_SUCCESS_URL`, and `SSO_FAILURE_URL`. Memory store is not supported in TOKEN mode. Token user data is stored in Redis under `{SESSION_KEY}:{email}:{tid}`; `SESSION_PREFIX` is used by the express-session Redis store, not by TOKEN-mode token keys.

### Use `identityProviders()` for login URLs; do not invent `login()` middleware

`SessionManager` does not expose a `login()` method. Do not generate code that adds an Express login middleware which calls Axios `POST /auth/login/:idp`; that duplicates the IdP contract and is easy to get wrong. The login entry point is `identityProviders()`: it proxies `GET /auth/providers?app_id=...`, and each provider object includes the login `url` that the browser/client should redirect to.

`identityProviders()` and `refresh()` both read an optional string `req.query.app_id` and fall back to `SSO_APP_ID` when it is empty or missing. Use this when one Express app integrates multiple IdP app registrations:

```javascript
app.get('/auth/providers', session.identityProviders()); // /auth/providers?app_id=tenant-a
app.post('/auth/refresh', session.authenticate(), session.requireUser(), session.refresh(initUser)); // SESSION or mode-agnostic
app.post('/auth/token-refresh', session.authenticate(), session.refresh(initUser)); // strict TOKEN-only
```

`refresh()` in SESSION mode reads `req.user`, so SESSION and mode-agnostic refresh routes need `authenticate()` + `requireUser()` + `refresh(...)`. Strict TOKEN-only refresh routes can use `authenticate()` + `refresh(...)` because TOKEN refresh loads the full user internally. TOKEN-mode `logout()?all=true` reads `req.user`; use `requireUser()` before `logout()` if the route supports all-device logout.

### `httpErrorHandler` must be the last middleware; `httpNotFoundHandler` goes immediately before it

```javascript
// ...all routes...
app.use(httpNotFoundHandler);   // catches unmatched routes
app.use(httpErrorHandler);      // formats CustomError → JSON response
```

Reversed order silently breaks 404 handling.

### `JwtManager.encrypt` and `decrypt` derive a key from `input` via hashing

The `input` argument is a **secret string**, not a `KeyObject`. The library hashes it with `JWT_SECRET_HASH_ALGORITHM` (default SHA-256) to produce the encryption key. The same algorithm must be used for both encrypt and decrypt — encrypting with default and decrypting with `secretHashAlgorithm: 'SHA-512'` will fail.

### Express type augmentation is global

The package augments `Express.Request` with `user?: SessionUser` and `express-session`'s `SessionData` with `[key: string]: any`. TypeScript consumers don't need to redeclare; just import normally.

## Standard Integration Recipe

A typical "SSO + protected API" integration looks like this. Copy from [examples/](examples/) when scaffolding:

1. Add an Identity Provider microservice URL to env (`SSO_ENDPOINT_URL`) — consult [references/identity-provider.md](references/identity-provider.md) if the user asks what endpoints that service must expose.
2. Create `config/session-manager.js` with the singleton (see [examples/session-mode.js](examples/session-mode.js) or [examples/token-mode.js](examples/token-mode.js)).
3. In `app.js`: `await session.setup(app)` before defining routes.
4. Wire `session.identityProviders()`, `session.callback()`, `session.refresh()`, `session.logout()` to your auth routes. For login, render or redirect to the `url` returned by `identityProviders()`; do not add a custom Axios call to `/auth/login/:idp`.
5. Protect routes with `session.authenticate()` + `session.requireUser()`.
6. For SESSION or mode-agnostic refresh routes, use `session.authenticate()` + `session.requireUser()` + `session.refresh(initUser)`. For strict TOKEN-only refresh routes, `session.authenticate()` + `session.refresh(initUser)` is enough.
7. For logout routes that support TOKEN-mode `?all=true`, use `session.authenticate()` + `session.requireUser()` + `session.logout()`.
8. Put one `FlexRouter` around each `express.Router()` instance, export those entries in a `routers` array, then mount that array from the app entry.
9. Add `httpNotFoundHandler` then `httpErrorHandler` last.

The complete wiring is shown in [examples/full-app.js](examples/full-app.js).

## Choosing SESSION vs TOKEN Mode

Ask the user (or infer from context) before recommending one:
- **SESSION** — server-rendered web app, cookies acceptable, single-device. Memory store works for dev; Redis recommended for prod.
- **TOKEN** — SPA, mobile, public API, multi-device. Redis is required. Client stores JWT in `localStorage` under the configured `SESSION_KEY`.

If unsure, default to SESSION (it's the library default and simpler to wire).

## Examples

Working integration snippets are in `examples/`:
- [examples/install.sh](examples/install.sh) — install + `.npmrc` setup
- [examples/session-mode.js](examples/session-mode.js) — minimal SESSION-mode singleton + app
- [examples/token-mode.js](examples/token-mode.js) — minimal TOKEN-mode singleton + app
- [examples/full-app.js](examples/full-app.js) — app entry that mounts feature-exported FlexRouter arrays
- [examples/routes.js](examples/routes.js) and [examples/features/*/routes.js](examples/features/users/routes.js) — feature-module `routers` export pattern
- [examples/jwt-standalone.js](examples/jwt-standalone.js) — `JwtManager` for non-SSO token flows
- [examples/error-handler.js](examples/error-handler.js) — error middleware + Axios error conversion; install `zod` if copying the validation example

## References

Detailed per-component docs (load only the one matching the user's task):
- [references/api-surface.md](references/api-surface.md) — every export and signature
- [references/session-manager.md](references/session-manager.md) — config options, modes, lifecycle, lock semantics
- [references/identity-provider.md](references/identity-provider.md) — required IdP microservice endpoints
- [references/flex-router.md](references/flex-router.md) — mount semantics, middleware chains
- [references/jwt-manager.md](references/jwt-manager.md) — JWE algorithms, expiration formats, claim validation
- [references/redis-manager.md](references/redis-manager.md) — TLS connections, direct client usage
- [references/http-handlers.md](references/http-handlers.md) — error response shape, Zod / Axios helpers
- [references/logger.md](references/logger.md) — singleton pattern, color detection, NODE_ENV behavior

## Evals

Use [evals/evals.json](evals/evals.json) as the starting prompt set when checking whether changes to this skill improve integration guidance. The set covers SESSION setup, TOKEN mode refresh/app_id behavior, HTTP error handler response shape, and import-style selection.
