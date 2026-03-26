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

## SessionMode Constants

SessionManager provides constants to identify the authentication mode:

```javascript
import { SessionMode } from '@igxjs/node-components';

console.log(SessionMode.SESSION); // 'session'
console.log(SessionMode.TOKEN);    // 'token'
```

## Configuration Options

```javascript
// Example configuration object
import { SessionMode } from '@igxjs/node-components';

const config = {
  // Session Mode
  SESSION_MODE: SessionMode.SESSION, // SessionMode.SESSION (default) or SessionMode.TOKEN

  // SSO Configuration
  SSO_ENDPOINT_URL: 'https://sso.example.com',
  SSO_APP_ID: 'your-client-id',
  SSO_JWT_SECRET: 'your-client-secret',
  SSO_SUCCESS_URL: '/dashboard',      // Required for TOKEN mode
  SSO_FAILURE_URL: '/login',          // Required for TOKEN mode

  // Session Configuration
  SESSION_AGE: 64800,                  // 18 hours in seconds
  SESSION_COOKIE_PATH: '/',
  SESSION_SECRET: 'your-session-secret',
  SESSION_KEY: 'session_token',        // Key name used to store user data (default)
  SESSION_EXPIRY_KEY: 'session_expires_at',  // LocalStorage key name for expiry timestamp (default)
  TOKEN_STORAGE_TEMPLATE_PATH: '/path/to/custom-template.html',  // Optional: Custom HTML template for TOKEN mode

  // Redis Configuration (optional - uses memory store if not provided; Required for TOKEN mode)
  REDIS_URL: 'redis://localhost:6379',
  REDIS_CERT_PATH: '/path/to/cert.pem', // Optional for TLS connections
  
  // JWT Configuration (used internally by SessionManager for TOKEN mode)
  JWT_ALGORITHM: 'dir',                 // Default: 'dir'
  JWT_ENCRYPTION: 'A256GCM',            // Default: 'A256GCM'
  JWT_CLOCK_TOLERANCE: 30,              // Default: 30 seconds
  JWT_SECRET_HASH_ALGORITHM: 'SHA-256', // Default: 'SHA-256'
  JWT_ISSUER: 'your-app',               // Optional
  JWT_AUDIENCE: 'your-app-users',       // Optional
  JWT_SUBJECT: 'authentication',        // Optional
};
```

### Configuration Options Reference

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|---------|
| `SSO_ENDPOINT_URL` | string | Yes | - | **Identity Provider microservice endpoint URL** - Base URL for your customized SSO authentication service. See [Identity Provider Microservice](#identity-provider-microservice) section for API details. Example: `https://idp.example.com/open/api/v1` |
| `SSO_APP_ID` | string | Yes | - | Application ID used to integrate with the Identity Provider microservice |
| `SSO_JWT_SECRET` | string | Yes | - | SSO client secret |
| `SSO_SUCCESS_URL` | string | TOKEN only | - | Redirect URL after successful login |
| `SSO_FAILURE_URL` | string | TOKEN only | - | Redirect URL after failed login |
| `SESSION_MODE` | string | No | `SessionMode.SESSION` | Session mode: `SessionMode.SESSION` or `SessionMode.TOKEN` |
| `SESSION_AGE` | number | No | 64800 | Session/token timeout in seconds (default: 64800 = 18 hours) |
| `SESSION_COOKIE_PATH` | string | No | `'/'` | Session cookie path (SESSION mode) |
| `SESSION_SECRET` | string | Yes | - | **JWT secret key used for encrypting/decrypting JWT tokens** |
| `SESSION_KEY` | string | No | `'session_token'` | **Key name used to store user data** |
|   |   |   |   | • SESSION mode: Key name in Express session storage (`req.session['session_token']`) |
|   |   |   |   | • TOKEN mode: LocalStorage key name for JWT token + prefix for Redis token storage |
| `SESSION_EXPIRY_KEY` | string | No | `'session_expires_at'` | **LocalStorage key name for session expiry timestamp (TOKEN mode only)** |
|   |   |   |   | • Stores the expires_at timestamp in browser's localStorage for client-side expiration checking |
| `TOKEN_STORAGE_TEMPLATE_PATH` | string | No | Built-in template | **Path to custom HTML template for TOKEN mode callback** |
|   |   |   |   | • Used to customize the redirect page that stores JWT token and expiry in localStorage |
|   |   |   |   | • Supports placeholders: `{{SESSION_DATA_KEY}}`, `{{SESSION_DATA_VALUE}}`, `{{SESSION_EXPIRY_KEY}}`, `{{SESSION_EXPIRY_VALUE}}`, `{{SSO_SUCCESS_URL}}`, `{{SSO_FAILURE_URL}}` |
|   |   |   |   | • If not provided, uses default built-in template |
| `SESSION_PREFIX` | string | No | `'ibmid:'` | Redis key prefix (used by default when not provided) |
| `REDIS_URL` | string | No | - | Redis connection URL (uses memory if not provided; **Required for TOKEN mode**) |
| `REDIS_CERT_PATH` | string | No | - | Path to Redis TLS certificate file (optional for TLS connections) |
| `JWT_ALGORITHM` | string | No | `'dir'` | JWE algorithm |
| `JWT_ENCRYPTION` | string | No | `'A256GCM'` | JWE encryption method |
| `JWT_CLOCK_TOLERANCE` | number | No | 30 | Clock skew tolerance in seconds |
| `JWT_SECRET_HASH_ALGORITHM` | string | No | `'SHA-256'` | Algorithm for hashing secrets |
| `JWT_ISSUER` | string | No | - | JWT issuer identifier |
| `JWT_AUDIENCE` | string | No | - | JWT audience identifier |
| `JWT_SUBJECT` | string | No | - | JWT subject identifier |

## Identity Provider Microservice

### Overview

The `SSO_ENDPOINT_URL` configuration points to a fully customized, independent Identity Provider (IdP) microservice that handles SSO authentication for your applications. This microservice is separate from your main application and serves as a centralized authentication service that can be shared across multiple applications.

### Endpoint URL Format

The endpoint URL should point to the base URL of your Identity Provider service:

```
https://idp.example.com/open/api/v1
```

### Identity Provider APIs

The Identity Provider microservice exposes the following REST APIs that SessionManager uses internally:

#### `GET /auth/providers`

Retrieves a list of supported identity providers (e.g., Google, Azure AD, SAML, etc.).

**Response includes:**
- `id` - Unique identifier for the identity provider
- `priority` - Display order in the provider list
- `name` - Human-readable name of the provider
- `url` - Login API URL for this provider
- `attributes` - UI display information
  - `icon` - URL to provider icon for login button
  - `kind` - Theme identifier (e.g., `primary`, `secondary`)

**Used by:** `identityProviders()` method

#### `POST /auth/login/:idp`

Generates a login URL with necessary parameters for the specified identity provider. This API constructs the complete URL that redirects users to the actual identity provider's login page.

**Parameters:**
- `:idp` - Identity provider ID from the providers list

**Used by:** Client applications to initiate SSO login flow

#### `POST /auth/verify`

Verifies the validity of a JWT token issued by the Identity Provider.

**Purpose:** Token validation and integrity checking

#### `GET /auth/callback/:idp`

Handles the callback from the identity provider after user authentication. Validates the authentication result and returns user data to the application.

**Parameters:**
- `:idp` - Identity provider ID

**Returns:** JWT token containing user information and session data

**Used by:** `callback()` method

#### `POST /auth/refresh`

Refreshes an expired or expiring access token without requiring the user to re-authenticate.

**Purpose:** Extends user sessions seamlessly

**Used by:** `refresh()` method

### Integration with SessionManager

SessionManager automatically configures an Axios instance using your `SSO_ENDPOINT_URL` and makes internal calls to these APIs during the authentication lifecycle. You don't need to call these APIs directly - SessionManager handles all communication with the Identity Provider microservice.

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
  SSO_APP_ID: process.env.SSO_APP_ID,
  SSO_JWT_SECRET: process.env.SSO_JWT_SECRET,
  SESSION_AGE: 64800,  // 18 hours in seconds
  SESSION_SECRET: process.env.SESSION_SECRET,  // JWT encryption key
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
await session.setup(app);

// Protect routes with session authentication
// requireUser() middleware loads user data into req.user
app.get('/protected', session.authenticate(), session.requireUser(), (req, res) => {
  res.json({ user: req.user });
});

// SSO callback for session-based auth (with user transformation)
app.get('/auth/callback', session.callback((user) => ({
  ...user,
  displayName: user.email?.split('@')[0],
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
  SSO_APP_ID: process.env.SSO_APP_ID,
  SSO_JWT_SECRET: process.env.SSO_JWT_SECRET,
  SSO_SUCCESS_URL: '/dashboard',
  SSO_FAILURE_URL: '/login',
  SESSION_MODE: SessionMode.TOKEN,  // Enable token-based authentication
  SESSION_AGE: 64800,  // 18 hours in seconds
  SESSION_SECRET: process.env.SESSION_SECRET,  // JWT encryption key
  SESSION_KEY: 'session_token',      // LocalStorage key name for JWT token (default)
  SESSION_EXPIRY_KEY: 'session_expires_at',  // LocalStorage key name for expiry timestamp (default)
  TOKEN_STORAGE_TEMPLATE_PATH: '/path/to/custom-template.html',  // Optional: Custom HTML template
  REDIS_URL: process.env.REDIS_URL,  // Required for TOKEN mode
});
```

#### Step 2: Setup and Use in Your Application

```javascript
// app.js
import express from 'express';
import { session } from './config/session-manager.js';

const app = express();

// Initialize session middleware (still required for TOKEN mode)
await session.setup(app);

// Protect routes with token authentication
// Client must send: Authorization: Bearer {token}
// requireUser() middleware loads user data from Redis into req.user
app.get('/api/protected', session.authenticate(), session.requireUser(), (req, res) => {
  res.json({ user: req.user });
});

// SSO callback - generates token and returns HTML page
// that stores token and expiry in localStorage, then redirects
// User transformation happens in callback
app.get('/auth/callback', session.callback((user) => ({
  ...user,
  displayName: user.email?.split('@')[0],
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
const token = localStorage.getItem('session_token');  // Uses SESSION_KEY (default)
const expiresAt = localStorage.getItem('session_expires_at');  // Uses SESSION_EXPIRY_KEY (default)

// Check if token is expired before making request
if (expiresAt && new Date(expiresAt) < new Date()) {
  // Token expired, redirect to login
  window.location.href = '/login';
}

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
  localStorage.setItem('session_token', data.token);  // Update token in localStorage
  localStorage.setItem('session_expires_at', data.user.attributes.expires_at);  // Update expiry
});

// Logout
fetch('/api/auth/logout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(() => {
  localStorage.removeItem('session_token');  // Remove token from localStorage
  localStorage.removeItem('session_expires_at');  // Remove expiry
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
  localStorage.removeItem('session_token');
  localStorage.removeItem('session_expires_at');
  window.location.href = '/login';
});
```

## Using requireUser() Middleware

The `requireUser()` middleware is designed to load full user data into `req.user` for both SESSION and TOKEN modes. This middleware should be used after authentication middleware.

### SESSION Mode Usage

```javascript
// User data is loaded from session store
app.get('/api/profile',
  session.authenticate(),
  session.requireUser(),
  (req, res) => {
    // req.user contains full user data from session
    res.json({
      email: req.user.email,
      displayName: req.user.displayName,
      attributes: req.user.attributes
    });
  }
);
```

### TOKEN Mode Usage

```javascript
// User data is loaded from Redis using the JWT token
app.get('/api/profile',
  session.authenticate(),  // Validates JWT token
  session.requireUser(),   // Loads user data from Redis
  (req, res) => {
    // req.user contains full user data from Redis
    res.json({
      email: req.user.email,
      displayName: req.user.displayName,
      attributes: req.user.attributes
    });
  }
);
```

### Benefits of requireUser()

1. **Request-level caching** - User data is loaded once per request
2. **Consistent API** - Works the same way for both SESSION and TOKEN modes
3. **Separation of concerns** - Authentication and data loading are separate steps
4. **Performance** - Avoids redundant Redis lookups in TOKEN mode

### When to Use

- ✅ Use when you need full user data in your route handlers
- ✅ Use after `authenticate()` or `verifyToken()`/`verifySession()`
- ✅ Use for routes that need user profile information
- ❌ Don't use if you only need to verify authentication (use `authenticate()` alone)

## API Methods

### Core Methods

- **`setup(app)`** - Initialize session configurations and middleware
  - `app`: Express application instance
  - Note: User transformation is done in `callback()` and `refresh()` methods, not in `setup()`

- **`authenticate(errorRedirectUrl?)`** - Protect routes based on configured SESSION_MODE
  - SESSION mode: Verifies user exists in session store and is authorized (checks `req.session` data directly)
  - TOKEN mode: Validates JWT token from Authorization header (lightweight validation)
  - **Important:** This method verifies authentication only and does NOT populate `req.user`
  - Use `requireUser()` after this middleware to load user data into `req.user`
  - `errorRedirectUrl`: Redirect URL on authentication failure
  - **Example:**
    ```javascript
    // Option 1: Just verify authentication (user data remains in req.session)
    app.get('/api/check', session.authenticate(), (req, res) => {
      res.json({ authenticated: true });
    });

    // Option 2: Verify authentication AND populate req.user (recommended)
    app.get('/api/profile',
      session.authenticate(),    // Verifies session/token validity
      session.requireUser(),     // Loads user data into req.user
      (req, res) => {
        res.json({ user: req.user }); // User data now available
      }
    );
    ```

- **`requireUser()`** - Middleware to load full user data into `req.user`
  - SESSION mode: Loads user from session store
  - TOKEN mode: Loads user from Redis using JWT token
  - Provides request-level caching to avoid redundant lookups
  - Should be used after `authenticate()` middleware
  - **Example:**
    ```javascript
    app.get('/api/profile', session.authenticate(), session.requireUser(), (req, res) => {
      res.json({ user: req.user }); // User data available here
    });
    ```

- **`verifySession(errorRedirectUrl?)`** - Explicit session-based authentication
  - Forces session verification regardless of SESSION_MODE
  - `errorRedirectUrl`: Redirect URL on authentication failure

- **`verifyToken(errorRedirectUrl?)`** - Explicit token-based authentication
  - Forces token verification regardless of SESSION_MODE
  - Requires `Authorization: Bearer {token}` header
  - `errorRedirectUrl`: Redirect URL on authentication failure

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
  - Returns count of tokens removed when logging out all tokens

### Utility Methods

- **`redisManager()`** - Get the RedisManager instance
  - Returns: RedisManager instance or null if not using Redis

- **`getUser(req)`** - Get authenticated user data (works for both SESSION and TOKEN modes)
  - **Parameters:**
    - `req` (Request, required): Express request object
  - **Returns:** Promise resolving to full user data object
  - **Throws:** `CustomError` UNAUTHORIZED (401) if user is not authenticated
  - **Use Cases:**
    - Custom middleware requiring user data
    - Building custom authentication flows
    - Accessing user data in non-standard scenarios
  - **Behavior:**
    - TOKEN mode: Fetches user from Redis using Authorization header
    - SESSION mode: Fetches user from session store
  - **Example:**
    ```javascript
    // Use in custom middleware
    app.use(async (req, res, next) => {
      try {
        const user = await session.getUser(req);
        req.customUser = user;
        next();
      } catch (error) {
        next(error);
      }
    });

    // Use in route handlers
    app.get('/api/custom', async (req, res) => {
      try {
        const user = await session.getUser(req);
        res.json({ user });
      } catch (error) {
        res.status(401).json({ error: 'Unauthorized' });
      }
    });
    ```

- **`hasLock(email)`** - Check if email has a session refresh lock
  - Prevents concurrent refresh operations
  - Returns: boolean

- **`lock(email)`** - Lock email for session refresh
  - Creates 60-second lock to prevent concurrent refreshes
  - Automatically clears expired locks

- **`clearLocks()`** - Clear expired session refresh locks
  - Called automatically by `lock()` - Can be called manually for cleanup

- **`getSessionMode()`** - Get the current session mode
  - Returns: `SessionMode.SESSION` (`'session'`) or `SessionMode.TOKEN` (`'token'`) based on configuration
  - Useful for conditional logic based on authentication mode
  - **Example:**
    ```javascript
    import { SessionMode } from '@igxjs/node-components';

    if (session.getSessionMode() === SessionMode.TOKEN) {
      // Handle token-specific logic
    }
    ```

## Authentication Flow Comparison

### SESSION Mode Flow

1. User clicks "Login" → Redirected to SSO provider
2. SSO authenticates user → Redirects to `/auth/callback?jwt=...`
3. `session.callback()` decrypts JWT → Saves user to session store under key name `SESSION_KEY` (default: 'session_token')
4. User redirected to success URL with session cookie
5. Protected routes verify session cookie → Access user via `req.user`
6. Logout destroys session and clears cookie

### TOKEN Mode Flow

1. User clicks "Login" → Redirected to SSO provider
2. SSO authenticates user → Redirects to `/auth/callback?jwt=...`
3. `session.callback()` decrypts JWT → Generates JWT token → Stores in Redis under key pattern: `{SESSION_KEY}:{email}:{tid}`
4. Returns HTML page that saves token to localStorage under `SESSION_KEY` (default: 'session_token') and expiry timestamp under `SESSION_EXPIRY_KEY` (default: 'session_expires_at') → Redirects to success URL
5. Client includes token in `Authorization: Bearer {token}` header
6. Protected routes verify token → Access user via `req.user`
7. Logout removes token from Redis (current or all tokens)

## Token Storage in Redis

In TOKEN mode, two types of data are stored in Redis:

### 1. User Data (TTL based on SESSION_AGE)

```
Key Pattern: {SESSION_PREFIX}{SESSION_KEY}:{email}:{tid}
Value: JSON.stringify(user)
TTL: SESSION_AGE / 1000 seconds

Example (default SESSION_KEY='session_token', SESSION_PREFIX='ibmid:'):
Key: ibmid:session_token:user@example.com:550e8400-e29b-41d4-a716-934b00000001
Value: {"email":"user@example.com","name":"John Doe","authorized":true}
TTL: 64800 seconds (18 hours)
```

### 2. Refresh Locks

```
Key Pattern: {SESSION_PREFIX}refresh_lock:{email}
Value: timestamp of lock creation in milliseconds
TTL: 60 seconds (lock duration)
```

### Multiple Device Support

Each device/session gets a unique `tid`, allowing users to be authenticated on multiple devices simultaneously. When logging out:
- `logout()` - Removes only the current token
- `logout()?all=true` - Removes all tokens for the user (all devices)

## Session Refresh Locks

SessionManager includes built-in protection against concurrent refresh operations to prevent race conditions:

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

**Key Features:**
- Prevents concurrent token/session refresh attacks
- 60-second lock duration
- Automatic lock expiration
- Used internally by `refresh()` method

## SESSION_KEY and SESSION_EXPIRY_KEY Configuration Explained

**Both keys serve different but related purposes depending on the authentication mode:**

### SESSION_KEY

Default value is `'session_token'`. You can customize this by setting `SESSION_KEY` in your configuration.

In **SESSION Mode**:
- Acts as the key name in Express session storage
- User data is stored as: `req.session[SESSION_KEY]` (e.g., `req.session['session_token']`)
- Session ID and secret are handled automatically by express-session

In **TOKEN Mode**:
- Acts as the LocalStorage key name where client stores the JWT token
- Acts as the prefix for Redis token storage keys (key pattern: `{SESSION_KEY}:{email}:{tid}`)
- Default value is `'session_token'`, so localStorage stores token at `localStorage['session_token']`

### SESSION_EXPIRY_KEY

**Purpose:** Stores the session expiry timestamp in the browser's localStorage, enabling client-side expiration checking without contacting the server.

Default value is `'session_expires_at'`. You can customize this by setting `SESSION_EXPIRY_KEY` in your configuration.

In **TOKEN Mode**:
- Acts as the localStorage key name for storing expiry timestamp
- Used to store the `expires_at` value from SSO response
- Stored on the client side in localStorage (NOT in Redis)
- Allows clients to check token expiration locally before making API requests

Example usage:
```javascript
// Client can check if token is expired using localStorage
const expiresAt = localStorage.getItem('session_expires_at');
if (new Date(expiresAt) < new Date()) {
  // Token is expired, perform re-authentication
  window.location.href = '/login';
}
```

## Security Considerations

### SESSION Mode

**Data Storage:**
- User data stored in Express session store (Redis or memory)
- Session cookie is automatically set by express-session
- Sessions are encrypted using `SESSION_SECRET` for server-side storage

**Client-Side Flow:**
- Client receives JWT from SSO callback and stores it temporarily
- Express session manages authentication state between requests
- Session data is accessible via `req.user` in protected routes

**Security:**
- Use CSRF protection middleware (e.g., `csurf`)
- Set secure, HttpOnly cookies in production
- SESSION_SECRET must be cryptographically strong

**Use Cases:**
- Traditional web applications with server-side rendering
- Applications where cookies are acceptable
- Single-device/single-browser sessions

### TOKEN Mode

**Data Storage:**
- JWT tokens encrypted with `SESSION_SECRET` and stored in Redis
- Token key pattern: `{SESSION_KEY}:{email}:{tid}` (default: `session_token:*`)
- Each token has unique ID (`tid`) for multi-device support
- User data stored in Redis using same key prefix
- Expiry timestamp stored in client's localStorage (not Redis)

**Client-Side Flow:**
1. SSO callback returns HTML page with JavaScript that stores JWT token and expiry timestamp in localStorage
2. Client includes `Authorization: Bearer {token}` header in requests
3. Tokens validated against Redis storage
4. Each device gets its own token (`tid`)

**Security:**
- **Not vulnerable to CSRF** (no cookies)
- Requires HTTPS in production (JWT contains sensitive user data)
- localStorage is vulnerable to XSS attacks
- Consider using secure, isolated storage if possible
- SESSION_SECRET must be cryptographically strong
- Expiry timestamp in localStorage can be used for client-side validation but should not be solely relied upon for security

**Use Cases:**
- Single Page Applications (SPAs)
- Mobile applications
- APIs requiring stateless authentication
- Multi-device sessions (each device gets its own token)

## Best Practices

1. **Always use HTTPS in production** - Especially critical for TOKEN mode
2. **Set strong SESSION_SECRET** - Use cryptographically secure random strings
3. **Configure appropriate SESSION_AGE** - Balance security vs. user experience
4. **Use Redis in production** - Memory store is for development only
5. **Implement rate limiting** - Protect refresh and callback endpoints
6. **Sanitize user data** - Always validate and sanitize in `updateUser` function
7. **Monitor Redis** - Set up alerts for connection issues
8. **Rotate secrets** - Periodically update SESSION_SECRET and SSO credentials
9. **Client-side expiry checks** - Use SESSION_EXPIRY_KEY for better UX but always validate server-side

## Error Handling

SessionManager throws `CustomError` instances for various failure scenarios with improved error detection:

```javascript
import { httpCodes } from '@igxjs/node-components';

// Common error scenarios:
// - httpCodes.UNAUTHORIZED (401): Token/session invalid or expired
// - httpCodes.FORBIDDEN (403): User not authorized
// - httpCodes.CONFLICT (409): Refresh operation locked
// - httpCodes.BAD_REQUEST (400): Invalid JWT payload
// - httpCodes.SYSTEM_FAILURE (500): Redis connection or other system errors

// Enhanced JWT error detection:
// - ERR_JWT_EXPIRED: Specific handling for expired tokens
// - Better error messages for debugging

// Handle errors in your error middleware
app.use((err, req, res, next) => {
  if (err.code === httpCodes.UNAUTHORIZED) {
    // Redirect to login or return 401
    return res.status(401).json({ error: 'Authentication required' });
  }
  // ... handle other errors
});
```

**Improved Error Handling Features:**
- Specific JWT error code detection (`ERR_JWT_EXPIRED`)
- More descriptive error messages
- Better debugging support in development mode
- Consistent error format across SESSION and TOKEN modes

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
  SESSION_AGE: 3600000
});
```

2. **Update client-side code** to use Bearer tokens instead of cookies (access token via `localStorage.getItem('session_token')`)

3. **Update API endpoints** to expect `Authorization` header

4. **Test thoroughly** before deploying to production

5. **Consider gradual rollout** - Run both modes temporarily during migration

## Related Documentation

- [RedisManager](./redis-manager.md) - Used internally by SessionManager for Redis storage
- [JWT Manager](./jwt-manager.md) - Used internally for token encryption/decryption
- [HTTP Handlers](./http-handlers.md) - Error handling utilities used by SessionManager
- [Back to main documentation](../README.md)