# Node Components

Shared components for Express.js applications providing session management, routing utilities, error handling, JWT authentication, and Redis integration.

## Installation

```bash
npm install @igxjs/node-components
```

## Components

| Component | Description | Documentation |
|-----------|-------------|---------------|
| **SessionManager** | SSO session management with Redis/memory storage, supporting both session and token-based authentication | [View docs](./docs/session-manager.md) |
| **Logger** | High-performance logging utility with zero dependencies and smart color detection | [View docs](./docs/logger.md) |
| **FlexRouter** | Flexible routing with context paths and middleware | [View docs](./docs/flex-router.md) |
| **RedisManager** | Redis connection management with TLS support | [View docs](./docs/redis-manager.md) |
| **JWT Manager** | Secure JWT encryption/decryption with JWE | [View docs](./docs/jwt-manager.md) |
| **HTTP Handlers** | Standardized error handling and status codes | [View docs](./docs/http-handlers.md) |

## Quick Start Examples

### SessionManager

```javascript
import { SessionManager, SessionMode } from '@igxjs/node-components';

// Create singleton instance with SESSION authentication (default)
export const session = new SessionManager({
  SSO_ENDPOINT_URL: process.env.SSO_ENDPOINT_URL,
  SSO_CLIENT_ID: process.env.SSO_CLIENT_ID,
  SSO_JWT_SECRET: process.env.SSO_JWT_SECRET,
  SESSION_SECRET: process.env.SESSION_SECRET,
  REDIS_URL: process.env.REDIS_URL
});

// Create singleton instance with TOKEN authentication
export const tokenSession = new SessionManager({
  SESSION_MODE: SessionMode.TOKEN,  // Use token-based authentication
  SSO_ENDPOINT_URL: process.env.SSO_ENDPOINT_URL,
  SSO_CLIENT_ID: process.env.SSO_CLIENT_ID,
  SSO_JWT_SECRET: process.env.SSO_JWT_SECRET,
  SESSION_SECRET: process.env.SESSION_SECRET,
  REDIS_URL: process.env.REDIS_URL,
});

// Setup in your app
await session.setup(app);

// Protect routes - user data automatically loaded into req.user
app.get('/protected', session.authenticate(), session.requireUser(), (req, res) => {
  res.json({ user: req.user });
});

// SSO callback with user transformation
app.get('/auth/callback', session.callback((user) => ({
  ...user,
  displayName: user.email
})));
```

[📖 Full SessionManager Documentation](./docs/session-manager.md)

### FlexRouter

```javascript
import { Router } from 'express';
import { FlexRouter } from '@igxjs/node-components';

const apiRouter = Router();
apiRouter.get('/users', (req, res) => res.json({ users: [] }));

// Mount with context path and middleware
const flexRouter = new FlexRouter('/api/v1', apiRouter, [authenticate]);
flexRouter.mount(app, '');
```

[📖 Full FlexRouter Documentation](./docs/flex-router.md)

### JWT Manager

```javascript
import { JwtManager } from '@igxjs/node-components';

// Constructor uses UPPERCASE naming with JWT_ prefix
const jwt = new JwtManager({ JWT_EXPIRATION_TIME: 64800 });
const SECRET = process.env.JWT_SECRET;

// Create token (encrypt method uses camelCase for per-call options)
const token = await jwt.encrypt({ userId: '123', email: 'user@example.com' }, SECRET);

// Verify token
const { payload } = await jwt.decrypt(token, SECRET);
```

[📖 Full JWT Manager Documentation](./docs/jwt-manager.md)

### HTTP Handlers

```javascript
import {
  httpCodes,
  httpError,
  httpErrorHandler,
  httpNotFoundHandler
} from '@igxjs/node-components';

// Use in routes
app.get('/api/data', async (req, res, next) => {
  try {
    const data = await fetchData();
    res.json(data);
  } catch (error) {
    next(httpError(httpCodes.SYSTEM_FAILURE, 'Failed to fetch data', error));
  }
});

// Add middleware
app.use(httpNotFoundHandler);
app.use(httpErrorHandler);
```

[📖 Full HTTP Handlers Documentation](./docs/http-handlers.md)

## SessionManager Authentication Modes

The `SessionManager` supports two authentication modes:

### SESSION Mode (Default)

Uses traditional server-side session cookies. When a user authenticates via SSO, their session is stored in Redis or memory storage. The client sends the session cookie with each request to prove authentication.

**Configuration:**
- `SESSION_MODE`: `SessionMode.SESSION` (default) - Uses session-based authentication
- `SESSION_AGE`: Session timeout in seconds (default: 64800 = 18 hours)
- `REDIS_URL`: Redis connection string for session storage

**Auth Methods:**
- `session.authenticate(errorRedirectUrl)` - Protect routes with SSO session verification
- `session.verifySession(errorRedirectUrl)` - Explicit session verification method
- `session.requireUser()` - Middleware to load user data into `req.user` from session store
- `session.logout(redirect?, all?)` - Logout current session (or logout all for token mode)

### TOKEN Mode

Uses JWT bearer tokens instead of session cookies. When a user authenticates via SSO, a JWT token is generated and stored in Redis. The client includes the token in the Authorization header (`Bearer {token}`) with each request.

**Configuration:**
- `SESSION_MODE`: `SessionMode.TOKEN` - Uses token-based authentication
- `SSO_SUCCESS_URL`: Redirect URL after successful SSO login
- `SSO_FAILURE_URL`: Redirect URL after failed SSO login  
- `JWT_ALGORITHM`: JWT algorithm (default: `'dir'`)
- `JWT_ENCRYPTION`: Encryption algorithm (default: `'A256GCM'`)
- `JWT_CLOCK_TOLERANCE`: Clock skew tolerance in seconds (default: 30)

**Auth Methods:**
- `session.verifyToken(errorRedirectUrl)` - Protect routes with token verification
- `session.requireUser()` - Middleware to load user data into `req.user` from Redis using JWT token
- `session.callback(initUser)` - SSO callback handler for token generation
- `session.refresh(initUser)` - Refresh user authentication based on auth mode
- `session.logout(redirect?, all?)` - Logout current token or all tokens for user

**Token Storage (Client-Side):**

When using token-based authentication, the SSO callback returns an HTML page that stores the token in `localStorage` and redirects the user:

```javascript
// The token is automatically stored in localStorage by the callback HTML page
// Default keys (customizable via SESSION_KEY and SESSION_EXPIRY_KEY config):
localStorage.getItem('session_token');        // JWT token
localStorage.getItem('session_expires_at');   // Expiry timestamp

// Making authenticated requests from the client:
const token = localStorage.getItem('session_token');
fetch('/api/protected', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

**Note:** The actual localStorage keys used are determined by the `SESSION_KEY` and `SESSION_EXPIRY_KEY` configuration options (defaults shown above).

## SessionManager Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `SSO_ENDPOINT_URL` | string | - | Identity provider endpoint URL |
| `SSO_CLIENT_ID` | string | - | SSO client ID |
| `SSO_JWT_SECRET` | string | - | SSO client secret |
| `SSO_SUCCESS_URL` | string | - | Redirect URL after successful login (token mode) |
| `SSO_FAILURE_URL` | string | - | Redirect URL after failed login (token mode) |
| `SESSION_MODE` | string | `SessionMode.SESSION` | Authentication mode: `SessionMode.SESSION` or `SessionMode.TOKEN` |
| `SESSION_AGE` | number | 64800 | Session timeout in seconds (default: 64800 = 18 hours) |
| `SESSION_COOKIE_PATH` | string | `'/'` | Session cookie path |
| `SESSION_SECRET` | string | - | Session/JWT secret key |
| `SESSION_PREFIX` | string | `'ibmid:'` | Redis session/key prefix |
| `SESSION_KEY` | string | `'session_token'` | Redis key for session data (SESSION mode) or localStorage key for token (TOKEN mode) |
| `SESSION_EXPIRY_KEY` | string | `'session_expires_at'` | localStorage key for session expiry timestamp (TOKEN mode) |
| `TOKEN_STORAGE_TEMPLATE_PATH` | string | - | Path to custom HTML template for TOKEN mode callback |
| `REDIS_URL` | string | - | Redis connection URL (optional) |
| `REDIS_CERT_PATH` | string | - | Path to Redis TLS certificate |
| `JWT_ALGORITHM` | string | `'dir'` | JWT signing algorithm |
| `JWT_ENCRYPTION` | string | `'A256GCM'` | JWE encryption algorithm |
| `JWT_CLOCK_TOLERANCE` | number | 30 | Clock skew tolerance in seconds |
| `JWT_SECRET_HASH_ALGORITHM` | string | `'SHA-256'` | Algorithm for hashing secrets |
| `JWT_ISSUER` | string | - | JWT issuer identifier |
| `JWT_AUDIENCE` | string | - | JWT audience identifier |
| `JWT_SUBJECT` | string | - | JWT subject identifier |

## Features

- ✅ **SSO Integration** - Full SSO support with Redis or memory storage
- ✅ **Dual Authentication Modes** - SESSION (cookies) or TOKEN (Bearer tokens)
- ✅ **Token Refresh** - Automatic token refresh via SSO endpoints
- ✅ **Session Refresh Locks** - Prevent concurrent token/session refresh attacks
- ✅ **JWT Security** - Encrypted JWT tokens using JWE (jose library)
- ✅ **Flexible Routing** - Easy mounting with context paths and middleware
- ✅ **Redis Support** - TLS/SSL and automatic reconnection
- ✅ **Error Handling** - Standardized HTTP responses
- ✅ **TypeScript** - Complete type definitions included
- ✅ **Production Ready** - Session locking, auto-reconnection, error handling

## Requirements

- Node.js >= 18
- Express.js >= 4.x
- Redis (optional, for session storage)

## TypeScript Support

This package includes TypeScript definitions:

```typescript
import type { 
  SessionManager,
  SessionConfig,
  JwtManager,
  FlexRouter,
  RedisManager,
  CustomError 
} from '@igxjs/node-components';
```

## Documentation

📚 **[Complete Documentation](./docs/README.md)** - Detailed guides for all components

- [SessionManager Documentation](./docs/session-manager.md) - Comprehensive SSO session management guide
- [FlexRouter Documentation](./docs/flex-router.md) - Advanced routing patterns
- [RedisManager Documentation](./docs/redis-manager.md) - Redis connection management
- [JWT Manager Documentation](./docs/jwt-manager.md) - Token authentication guide
- [HTTP Handlers Documentation](./docs/http-handlers.md) - Error handling utilities

## License

[Apache 2.0](LICENSE)