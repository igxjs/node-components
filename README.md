# Node Components

Shared components for Express.js applications providing session management, routing utilities, error handling, JWT authentication, and Redis integration.

## Installation

```bash
npm install @igxjs/node-components
```

## Components

| Component | Description | Documentation |
|-----------|-------------|---------------|
| **SessionManager** | SSO session management with Redis/memory storage | [View docs](./docs/session-manager.md) |
| **FlexRouter** | Flexible routing with context paths and middleware | [View docs](./docs/flex-router.md) |
| **RedisManager** | Redis connection management with TLS support | [View docs](./docs/redis-manager.md) |
| **JWT Manager** | Secure JWT encryption/decryption with JWE | [View docs](./docs/jwt-manager.md) |
| **HTTP Handlers** | Standardized error handling and status codes | [View docs](./docs/http-handlers.md) |

## Quick Start Examples

### SessionManager

```javascript
import { SessionManager } from '@igxjs/node-components';

// Create singleton instance
export const session = new SessionManager({
  SSO_ENDPOINT_URL: process.env.SSO_ENDPOINT_URL,
  SSO_CLIENT_ID: process.env.SSO_CLIENT_ID,
  SSO_CLIENT_SECRET: process.env.SSO_CLIENT_SECRET,
  SESSION_SECRET: process.env.SESSION_SECRET,
  REDIS_URL: process.env.REDIS_URL
});

// Setup in your app
await session.setup(app, (user) => ({ ...user, displayName: user.email }));

// Protect routes
app.get('/protected', session.authenticate(), (req, res) => {
  res.json({ user: req.user });
});
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

const jwt = new JwtManager({ expirationTime: '1h' });
const SECRET = process.env.JWT_SECRET;

// Create token
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

## Features

- ✅ **SSO Integration** - Full SSO support with Redis or memory storage
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
