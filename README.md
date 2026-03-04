# Node Components

Shared components for Express.js applications providing session management, routing utilities, error handling, and Redis integration.

## Installation

```bash
npm install @igxjs/node-components
```

## Modules

### 1. Session Manager

Provides SSO (Single Sign-On) session management with support for Redis and memory-based session stores.

#### Configuration Options

```javascript
// Example configuration object
// All fields are strings except SESSION_AGE which is a number

const config = {
  // SSO Configuration
  SSO_ENDPOINT_URL: 'https://sso.example.com',
  SSO_CLIENT_ID: 'your-client-id',
  SSO_CLIENT_SECRET: 'your-client-secret',
  SSO_SUCCESS_URL: '/dashboard',
  SSO_FAILURE_URL: '/login',
  
  // Session Configuration
  SESSION_AGE: 64800000, // 18 hours in milliseconds
  SESSION_COOKIE_PATH: '/',
  SESSION_SECRET: 'your-session-secret',
  SESSION_PREFIX: 'app:',
  
  // Redis Configuration (optional - uses memory store if not provided)
  REDIS_URL: 'redis://localhost:6379',
  REDIS_CERT_PATH: '/path/to/cert.pem' // For TLS connections
};
```

#### Usage Example

```javascript
import express from 'express';
import { session } from '@igxjs/node-components';

const app = express();

// Initialize session
await session.setup(app, config, (user) => {
  // Process user object - compute permissions, avatar URL, etc.
  return {
    ...user,
    displayName: user.email?.split('@')[0],
    hasAdminAccess: user.authorized && user.email?.endsWith('@admin.com')
  };
});

// Protect routes with authentication
app.get('/protected', session.authenticate(), (req, res) => {
  res.json({ user: req.user });
});

// SSO callback endpoint
app.get('/auth/callback', session.callback((user) => {
  // Initialize user object after successful login
  return {
    ...user,
    loginTime: new Date()
  };
}));

// Get available identity providers
app.get('/auth/providers', session.identityProviders());

// Refresh user session
app.post('/auth/refresh', session.refresh((user) => {
  return { ...user, refreshedAt: new Date() };
}));

// Logout endpoint
app.get('/auth/logout', session.logout());
```

#### API Methods

- **`setup(app, config, updateUser)`** - Initialize session configurations
- **`sessionHandler()`** - Session RequestHandler (returns Promise<RequestHandler>)
- **`authenticate(isDebugging?, redirectUrl?)`** - Resource protection middleware
- **`callback(initUser)`** - SSO callback handler for successful login
- **`identityProviders()`** - Get available identity providers
- **`logout()`** - Application logout handler (not SSO logout)
- **`refresh(initUser)`** - Refresh user session with new token
- **`redisManager()`** - Get the RedisManager instance (returns RedisManager or null)
- **`hasLock(email)`** - Check if email has a session refresh lock
- **`lock(email)`** - Lock email for session refresh (prevents concurrent refreshes)
- **`clearLocks()`** - Clear expired session refresh locks

---

### 2. FlexRouter

A flexible routing utility for Express.js that allows mounting routers with custom context paths and middleware handlers.

#### Usage Example

```javascript
import { Router } from 'express';
import { FlexRouter } from '@igxjs/node-components';
// Assuming you have an authenticate middleware
// import { authenticate } from './middlewares/auth.js';

// Create routers
const publicRouter = Router();
const privateRouter = Router();

publicRouter.get('/health', (req, res) => {
  res.send('OK');
});

privateRouter.get('/users', (req, res) => {
  res.json({ users: [] });
});

// Define flex routers with context paths and optional middleware
export const routers = [
  new FlexRouter('/api/v1/public', publicRouter),
  new FlexRouter('/api/v1/protected', privateRouter, [authenticate]), // with middleware
];

// Mount all routers to your Express app
const app = express();
const basePath = '';

routers.forEach(router => {
  router.mount(app, basePath);
});

// Routes will be available at:
// - /api/v1/public/health
// - /api/v1/protected/users (with authenticate middleware)
```

#### API

- **`constructor(context, router, handlers?)`** - Create a new FlexRouter
  - `context` (string) - The context path for the router
  - `router` - Express Router instance
  - `handlers` - Optional array of middleware handlers
  
- **`mount(app, basePath)`** - Mount the router to an Express application
  - `app` - Express application instance
  - `basePath` (string) - Base path to prepend to the context

---

### 3. RedisManager

Redis connection management with TLS support and automatic reconnection handling.

* Note: the RedisManager is used internally by the `SessionManager`, so you don't need to use it directly.

#### Usage Example

```javascript
import { RedisManager } from '@igxjs/node-components';

const redisManager = new RedisManager();

// Connect to Redis (with optional TLS certificate)
const connected = await redisManager.connect(
  'rediss://localhost:6379',
  '/path/to/cert.pem'
);

if (connected) {
  // Get Redis client for direct operations
  const client = redisManager.getClient();
  await client.set('key', 'value');
  
  // Check connection status
  const isConnected = await redisManager.isConnected();
  
  // Disconnect when done
  await redisManager.disConnect();
}
```

#### API Methods

- **`connect(redisUrl, certPath)`** - Connect to Redis server
  - Returns: `Promise<boolean>` - Returns true if connected successfully
  - Supports both `redis://` and `rediss://` (TLS) URLs
  - Automatically handles TLS certificate loading when using `rediss://`

- **`getClient()`** - Get the Redis client instance
  - Returns: Redis client for direct operations

- **`isConnected()`** - Check if Redis connection is active
  - Returns: `Promise<boolean>` - Returns true if connected and responsive

- **`disConnect()`** - Disconnect from Redis server
  - Returns: `Promise<void>`

---

### 4. HTTP Handlers

Custom error handling utilities with standardized HTTP status codes and error responses.

#### Available Exports

```javascript
import { 
  CustomError, 
  httpErrorHandler, 
  httpCodes, 
  httpMessages,
  httpHelper 
} from '@igxjs/node-components';
```

#### Usage Examples

**Creating Custom Errors:**

```javascript
// Basic custom error
throw new CustomError(httpCodes.BAD_REQUEST, 'Invalid input data');

// With error details and additional data
throw new CustomError(
  httpCodes.UNAUTHORIZED,
  'Authentication failed',
  { originalError: err },
  { attemptedEmail: email }
);
```

**Handling Axios/HTTP Errors:**

```javascript
// Use httpHelper to handle Axios errors
try {
  await axios.get('https://api.example.com/data');
} catch (error) {
  // Convert Axios error to CustomError
  throw httpHelper.handleAxiosError(error, 'Failed to fetch data');
}

// Or use it in error handling
app.get('/api/data', async (req, res, next) => {
  try {
    const response = await axios.get('https://external-api.com/data');
    res.json(response.data);
  } catch (error) {
    return next(httpHelper.handleAxiosError(error, 'Failed to fetch external data'));
  }
});
```

**Error Handler Middleware:**

```javascript
import express from 'express';
import { httpErrorHandler } from '@igxjs/node-components';

const app = express();

// Your routes here
app.get('/api/data', async (req, res, next) => {
  try {
    // Your logic
  } catch (error) {
    next(error);
  }
});

// Add error handler as the last middleware
app.use(httpErrorHandler);
```

#### HTTP Codes & Messages

```javascript
httpCodes.OK                // 200
httpCodes.CREATED          // 201
httpCodes.NO_CONTENT       // 201
httpCodes.BAD_REQUEST      // 400
httpCodes.UNAUTHORIZED     // 401
httpCodes.FORBIDDEN        // 403
httpCodes.NOT_FOUND        // 404
httpCodes.NOT_ACCEPTABLE   // 406
httpCodes.CONFLICT         // 409
httpCodes.SYSTEM_FAILURE   // 500

// Corresponding messages
httpMessages.OK            // 'OK'
httpMessages.BAD_REQUEST   // 'Bad Request'
// ... etc
```

#### CustomError API

**Constructor:**
```javascript
// new CustomError(code, message, error, data)
// - code: number - HTTP status code
// - message: string - Error message
// - error: object (optional) - Original error object
// -  object (optional) - Additional error data
```

**Properties:**
- **`code`** - HTTP status code (number)
- **`message`** - Error message (string)
- **`error`** - Original error object (if provided)
- **`data`** - Additional error data (if provided)

#### httpHelper API

The `httpHelper` object provides utility methods for error handling:

**Methods:**

- **`httpHelper.handleAxiosError(error, defaultMessage)`** - Analyze and convert Axios/HTTP errors to CustomError
  - `error` (Error | AxiosError) - The error object to analyze
  - `defaultMessage` (string, optional) - Default message if error message cannot be extracted (default: 'An error occurred')
  - Returns: `CustomError` instance with extracted status code, message, and data

- **`httpHelper.format(str, ...args)`** - Format a string with placeholders
  - `str` (string) - String with `{0}`, `{1}`, etc. placeholders
  - `...args` - Values to replace placeholders
  - Returns: Formatted string

- **`httpHelper.toZodMessage(error)`** - Generate friendly Zod validation error message
  - `error` (ZodError) - Zod validation error
  - Returns: Formatted error message string

---

## Features

- ✅ **Session Management** - Full SSO integration with Redis or memory storage
- ✅ **Flexible Routing** - Easy mounting of routers with context paths and middleware
- ✅ **Redis Integration** - Robust Redis connection management with TLS support
- ✅ **Error Handling** - Standardized error responses and HTTP status codes
- ✅ **TypeScript Support** - Complete type definitions included
- ✅ **Session Locking** - Prevents concurrent session refresh operations
- ✅ **Automatic Reconnection** - Redis auto-reconnect with event handling

## Requirements

- Node.js >= 18
- Express.js >= 4.x
- Redis (optional, for session storage)

## TypeScript

This package includes TypeScript definitions. You can import types in TypeScript projects:

```typescript
import type { 
  SessionConfig, 
  SessionManager,
  SessionUser,
  SessionUserAttributes,
  FlexRouter,
  RedisManager,
  CustomError 
} from '@igxjs/node-components';
```

## License

[Apache 2.0](LICENSE.md)