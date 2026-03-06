# SessionManager

Provides SSO (Single Sign-On) session management with support for Redis and memory-based session stores. Supports both **session-based** (cookies) and **token-based** (JWT Bearer tokens) authentication modes.

## Authentication Modes

SessionManager supports two authentication modes:

### SESSION Mode (Default)
Traditional server-side session cookies. When a user authenticates via SSO, their session is stored in Redis or memory storage. The client sends the session cookie with each request.

**Use cases:**
- Traditional web applications with server-side rendering
- Applications where cookies are acceptable
- Single-device/browser sessions

### TOKEN Mode
JWT bearer tokens stored in Redis. When a user authenticates via SSO, a JWT token is generated and stored in Redis. The client includes the token in the `Authorization: Bearer {token}` header with each request.

**Use cases:**
- Single Page Applications (SPAs)
- Mobile applications
- APIs requiring stateless authentication
- Multi-device sessions (each device gets its own token)

## Configuration Options

```javascript
// Example configuration object
import { SessionMode } from '@igxjs/node-components';

const config = {
  // Session Mode
  SESSION_MODE: SessionMode.SESSION, // SessionMode.SESSION (default) or SessionMode.TOKEN

  // SSO Configuration
  SSO_ENDPOINT_URL: 'https://sso.example.com',
  SSO_CLIENT_ID: 'your-client-id',
  SSO_CLIENT_SECRET: 'your-client-secret',
  SSO_SUCCESS_URL: '/dashboard',      // Required for TOKEN mode
  SSO_FAILURE_URL: '/login',          // Required for TOKEN mode

  // Session Configuration
  SESSION_AGE: 64800000,               // 18 hours in milliseconds
  SESSION_COOKIE_PATH: '/',
  SESSION_SECRET: 'your-session-secret',
  SESSION_PREFIX: 'ibmid:',            // Default value when not provided

  // Redis Configuration (optional - uses memory store if not provided)
  REDIS_URL: 'redis://localhost:6379',
  REDIS_CERT_PATH: '/path/to/cert.pem', // For TLS connections
  
  // JWT Configuration (used internally by SessionManager for TOKEN mode)
  JWT_ALGORITHM: 'dir',                 // Default: 'dir'
  JWT_ENCRYPTION: 'A256GCM',            // Default: 'A256GCM'
  JWT_EXPIRATION_TIME: '10m',           // Default: '10m'
  JWT_CLOCK_TOLERANCE: 30,              // Default: 30 seconds
  JWT_SECRET_HASH_ALGORITHM: 'SHA-256', // Default: 'SHA-256'
  JWT_ISSUER: 'your-app',               // Optional
  JWT_AUDIENCE: 'your-app-users',       // Optional
  JWT_SUBJECT: 'authentication',        // Optional
};
```

### Configuration Options Reference

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `SSO_ENDPOINT_URL` | string | Yes | - | Identity provider endpoint URL |
| `SSO_CLIENT_ID` | string | Yes | - | SSO client ID |
| `SSO_CLIENT_SECRET` | string | Yes | - | SSO client secret |
| `SSO_SUCCESS_URL` | string | TOKEN only | - | Redirect URL after successful login |
| `SSO_FAILURE_URL` | string | TOKEN only | - | Redirect URL after failed login |
| `SESSION_MODE` | string | No | `SessionMode.SESSION` | Session mode: `SessionMode.SESSION` or `SessionMode.TOKEN` |
| `SESSION_AGE` | number | No | 64800000 | Session/token timeout in milliseconds |
| `SESSION_COOKIE_PATH` | string | No | `'/'` | Session cookie path (SESSION mode) |
| `SESSION_SECRET` | string | Yes | - | Session/JWT secret key |
| `SESSION_PREFIX` | string | No | `'ibmid:'` | Redis key prefix |
| `REDIS_URL` | string | No | - | Redis connection URL (uses memory if not provided) |
| `REDIS_CERT_PATH` | string | No | - | Path to Redis TLS certificate |
| `JWT_ALGORITHM` | string | No | `'dir'` | JWT signing algorithm |
| `JWT_ENCRYPTION` | string | No | `'A256GCM'` | JWE encryption algorithm |
| `JWT_EXPIRATION_TIME` | string | No | `'10m'` | Token expiration duration |
| `JWT_CLOCK_TOLERANCE` | number | No | 30 | Clock skew tolerance in seconds |
| `JWT_SECRET_HASH_ALGORITHM` | string | No | `'SHA-256'` | Algorithm for hashing secrets |
| `JWT_ISSUER` | string | No | - | JWT issuer identifier |
| `JWT_AUDIENCE` | string | No | - | JWT audience identifier |
| `JWT_SUBJECT` | string | No | - | JWT subject identifier |

## ⚠️ Important: Singleton Pattern

**SessionManager should be instantiated once and exported as a singleton.** 

**Why?**
- SessionManager manages Redis connections (if configured)
- Multiple instances can lead to connection pool exhaustion
- Session state consistency requires a single source of truth
- Middleware functions need to reference the same instance

**✅ Recommended:** Create a separate module that exports a single SessionManager instance  
**❌ Avoid:** Creating new SessionManager instances in multiple files

## Recommended File Structure

```
your-project/
├── src/
│   ├── config/
│   │   └── session-manager.js  ← Create SessionManager singleton here
│   ├── routes/
│   │   └── auth.js             ← Import session from config
│   └── app.js                  ← Import and setup session
└── package.json
```

## Usage Examples

### SESSION Mode (Default)

#### Step 1: Create SessionManager Singleton

```javascript
// config/session-manager.js
import { SessionManager, SessionMode } from '@igxjs/node-components';

// Create SessionManager with SESSION mode (default)
export const session = new SessionManager({
  SSO_ENDPOINT_URL: process.env.SSO_ENDPOINT_URL,
  SSO_CLIENT_ID: process.env.SSO_CLIENT_ID,
  SSO_CLIENT_SECRET: process.env.SSO_CLIENT_SECRET,
  SESSION_AGE: 64800000,
  SESSION_SECRET: process.env.SESSION_SECRET,
  REDIS_URL: process.env.REDIS_URL
});
```

#### Step 2: Setup and Use in Your Application

```javascript
// app.js
import express from 'express';
import { session } from './config/session-manager.js';

const app = express();

// Initialize session middleware
await session.setup(app, (user) => ({
  ...user,
  displayName: user.email?.split('@')[0]
}));

// Protect routes with session authentication
app.get('/protected', session.authenticate(), (req, res) => {
  res.json({ user: req.user });
});

// SSO callback for session-based auth
app.get('/auth/callback', session.callback((user) => ({
  ...user,
  loginTime: new Date()
})));

// Refresh session
app.post('/auth/refresh', session.authenticate(), session.refresh((user) => ({
  ...user,
  refreshedAt: new Date()
})));

// Logout session
app.get('/auth/logout', session.logout());

app.listen(3000);
```

### TOKEN Mode

#### Step 1: Create SessionManager Singleton

```javascript
// config/session-manager.js
import { SessionManager, SessionMode } from '@igxjs/node-components';

// Create SessionManager with TOKEN mode
export const session = new SessionManager({
  SSO_ENDPOINT_URL: process.env.SSO_ENDPOINT_URL,
  SSO_CLIENT_ID: process.env.SSO_CLIENT_ID,
  SSO_CLIENT_SECRET: process.env.SSO_CLIENT_SECRET,
  SSO_SUCCESS_URL: '/dashboard',
  SSO_FAILURE_URL: '/login',
  SESSION_MODE: SessionMode.TOKEN,  // Enable token-based authentication
  SESSION_AGE: 64800000,
  SESSION_SECRET: process.env.SESSION_SECRET,
  REDIS_URL: process.env.REDIS_URL,  // Required for TOKEN mode
  JWT_EXPIRATION_TIME: '1h'
});
```

#### Step 2: Setup and Use in Your Application

```javascript
// app.js
import express from 'express';
import { session } from './config/session-manager.js';

const app = express();

// Initialize session middleware (still required for TOKEN mode)
await session.setup(app, (user) => ({
  ...user,
  displayName: user.email?.split('@')[0]
}));

// Protect routes with token authentication
// Client must send: Authorization: Bearer {token}
app.get('/api/protected', session.authenticate(), (req, res) => {
  res.json({ user: req.user });
});

// SSO callback - generates token and returns HTML page
// that stores token in localStorage and redirects
app.get('/auth/callback', session.callback((user) => ({
  ...user,
  loginTime: new Date()
})));

// Refresh token
app.post('/api/auth/refresh', session.authenticate(), session.refresh((user) => ({
  ...user,
  refreshedAt: new Date()
})));

// Logout current token
app.post('/api/auth/logout', session.authenticate(), session.logout());

// Logout ALL tokens for this user (TOKEN mode only)
app.post('/api/auth/logout/all', session.authenticate(), session.logout());
// Use query param: /api/auth/logout?all=true

app.listen(3000);
```

#### Step 3: Client-Side Token Usage

When using TOKEN mode, the SSO callback returns an HTML page that stores the token in localStorage:

```javascript
// Client-side: Making authenticated requests
const token = localStorage.getItem('authToken');

fetch('/api/protected', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(response => response.json())
.then(data => console.log(data));

// Refresh token when it expires
fetch('/api/auth/refresh', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(response => response.json())
.then(data => {
  localStorage.setItem('authToken', data.token);
  localStorage.setItem('tokenExpiry', Date.now() + data.expiresIn * 1000);
});

// Logout
fetch('/api/auth/logout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(() => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('tokenExpiry');
  localStorage.removeItem('user');
  window.location.href = '/login';
});

// Logout from all devices (TOKEN mode only)
fetch('/api/auth/logout?all=true', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(() => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('tokenExpiry');
  localStorage.removeItem('user');
  window.location.href = '/login';
});
```

## API Methods

### Core Methods

- **`setup(app, updateUser)`** - Initialize session configurations and middleware
  - `app`: Express application instance
  - `updateUser`: Function to transform user object after authentication

- **`authenticate(isDebugging?, redirectUrl?)`** - Protect routes based on configured SESSION_MODE
  - Uses `verifySession()` for SESSION mode
  - Uses `verifyToken()` for TOKEN mode
  - `isDebugging`: Skip authentication checks (default: false)
  - `redirectUrl`: Redirect URL on authentication failure

- **`verifySession(isDebugging?, redirectUrl?)`** - Explicit session-based authentication
  - Forces session verification regardless of SESSION_MODE
  - `isDebugging`: Skip authentication checks (default: false)
  - `redirectUrl`: Redirect URL on authentication failure

- **`verifyToken(isDebugging?, redirectUrl?)`** - Explicit token-based authentication
  - Forces token verification regardless of SESSION_MODE
  - Requires `Authorization: Bearer {token}` header
  - `isDebugging`: Skip authentication checks (default: false)
  - `redirectUrl`: Redirect URL on authentication failure

- **`callback(initUser)`** - SSO callback handler for successful login
  - `initUser`: Function to transform SSO user object
  - SESSION mode: Saves session and redirects
  - TOKEN mode: Generates token, returns HTML page with localStorage script

- **`identityProviders()`** - Get available identity providers from SSO endpoint

- **`refresh(initUser)`** - Refresh user authentication based on SESSION_MODE
  - SESSION mode: Refreshes session data
  - TOKEN mode: Generates new token, invalidates old token
  - `initUser`: Function to transform refreshed user object
  - Returns: New token data (TOKEN mode) or user data (SESSION mode)

- **`logout()`** - Application logout handler
  - SESSION mode: Destroys session and clears cookie
  - TOKEN mode: Invalidates current token or all tokens (with `?all=true` query param)
  - Query params:
    - `redirect=true`: Redirect to SSO_SUCCESS_URL/SSO_FAILURE_URL
    - `all=true`: Logout all tokens for user (TOKEN mode only)

### Utility Methods

- **`redisManager()`** - Get the RedisManager instance
  - Returns: RedisManager instance or null if not using Redis

- **`hasLock(email)`** - Check if email has a session refresh lock
  - Prevents concurrent refresh operations
  - Returns: boolean

- **`lock(email)`** - Lock email for session refresh
  - Creates 60-second lock to prevent concurrent refreshes
  - Automatically clears expired locks

- **`clearLocks()`** - Clear expired session refresh locks
  - Called automatically by `lock()`
  - Can be called manually for cleanup

## Authentication Flow Comparison

### SESSION Mode Flow

1. User clicks "Login" → Redirected to SSO provider
2. SSO authenticates user → Redirects to `/auth/callback?jwt=...`
3. `session.callback()` decrypts JWT → Saves user to session store
4. User redirected to success URL with session cookie
5. Protected routes verify session cookie → Access user via `req.user`
6. Logout destroys session and clears cookie

### TOKEN Mode Flow

1. User clicks "Login" → Redirected to SSO provider
2. SSO authenticates user → Redirects to `/auth/callback?jwt=...`
3. `session.callback()` decrypts JWT → Generates JWT token → Stores in Redis
4. Returns HTML page that saves token to localStorage → Redirects to success URL
5. Client includes token in `Authorization: Bearer {token}` header
6. Protected routes verify token → Access user via `req.user`
7. Logout removes token from Redis (current or all tokens)

## Token Storage in Redis

In TOKEN mode, tokens are stored in Redis with the following structure:

```
Key Pattern: {SESSION_PREFIX}token:{email}:{tokenId}
Value: JSON.stringify(user)
TTL: SESSION_AGE / 1000 seconds

Example:
Key: ibmid:token:user@example.com:550e8400-e29b-41d4-a716-934b00000001
Value: {"email":"user@example.com","name":"John Doe","authorized":true}
TTL: 64800 seconds (18 hours)
```

### Multiple Device Support

Each device/session gets a unique `tokenId`, allowing users to be authenticated on multiple devices simultaneously. When logging out:
- `logout()` - Removes only the current token
- `logout()?all=true` - Removes all tokens for the user (all devices)

## Session Refresh Locks

SessionManager includes built-in protection against concurrent refresh operations:

```javascript
// Lock is automatically set during refresh operations
// Prevents race conditions when multiple requests try to refresh simultaneously
if (session.hasLock(email)) {
  // Refresh already in progress
  throw new Error('Token refresh is locked');
}

session.lock(email); // Sets 60-second lock
// ... perform refresh operation ...
// Lock automatically expires after 60 seconds
```

## Security Considerations

### SESSION Mode
- Session IDs are automatically generated by express-session
- Sessions stored server-side (Redis or memory)
- Vulnerable to CSRF (use CSRF protection middleware)
- Cookie-based, subject to cookie policies

### TOKEN Mode
- Tokens encrypted using JWE (JSON Web Encryption)
- Each token has a unique ID stored in Redis
- Token invalidation supported (logout)
- Requires secure storage on client (localStorage risks XSS)
- Not vulnerable to CSRF (no cookies)
- Requires HTTPS in production

### Best Practices

1. **Always use HTTPS in production** - Especially critical for TOKEN mode
2. **Set strong SESSION_SECRET** - Use cryptographically secure random strings
3. **Configure appropriate SESSION_AGE** - Balance security vs. user experience
4. **Use Redis in production** - Memory store is for development only
5. **Implement rate limiting** - Protect refresh and callback endpoints
6. **Sanitize user data** - Always validate and sanitize in `updateUser` function
7. **Monitor Redis** - Set up alerts for connection issues
8. **Rotate secrets** - Periodically update SESSION_SECRET and SSO credentials

## Error Handling

SessionManager throws `CustomError` instances for various failure scenarios:

```javascript
import { httpCodes } from '@igxjs/node-components';

// Common error scenarios:
// - httpCodes.UNAUTHORIZED (401): Token/session invalid or expired
// - httpCodes.FORBIDDEN (403): User not authorized
// - httpCodes.CONFLICT (409): Refresh operation locked
// - httpCodes.BAD_REQUEST (400): Invalid JWT payload
// - httpCodes.SYSTEM_FAILURE (500): Redis connection or other system errors

// Handle errors in your error middleware
app.use((err, req, res, next) => {
  if (err.code === httpCodes.UNAUTHORIZED) {
    // Redirect to login or return 401
    return res.status(401).json({ error: 'Authentication required' });
  }
  // ... handle other errors
});
```

## Migrating from SESSION to TOKEN Mode

If you need to migrate an existing application:

1. **Add new configuration** to support TOKEN mode:
```javascript
import { SessionMode } from '@igxjs/node-components';

const session = new SessionManager({
  // ... existing config
  SESSION_MODE: SessionMode.TOKEN,
  SSO_SUCCESS_URL: '/dashboard',
  SSO_FAILURE_URL: '/login',
  JWT_EXPIRATION_TIME: '1h'
});
```

2. **Update client-side code** to use Bearer tokens instead of cookies

3. **Update API endpoints** to expect `Authorization` header

4. **Test thoroughly** before deploying to production

5. **Consider gradual rollout** - Run both modes temporarily during migration

## Related Documentation

- [RedisManager](./redis-manager.md) - Used internally by SessionManager for Redis storage
- [JWT Manager](./jwt-manager.md) - Used internally for token encryption/decryption
- [HTTP Handlers](./http-handlers.md) - Error handling utilities used by SessionManager
- [Back to main documentation](../README.md)
