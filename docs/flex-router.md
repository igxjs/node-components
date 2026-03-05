# FlexRouter

A flexible routing utility for Express.js that allows mounting routers with custom context paths and middleware handlers.

## Overview

FlexRouter provides a convenient way to organize and mount Express routers with predefined context paths and optional middleware. This is particularly useful for:
- API versioning (e.g., `/api/v1`, `/api/v2`)
- Separating public and protected routes
- Applying middleware to specific route groups
- Managing complex routing hierarchies

## Usage Example

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

## Advanced Usage

### Multiple Middleware

You can apply multiple middleware functions to a FlexRouter:

```javascript
import { rateLimiter } from './middlewares/rate-limiter.js';
import { logger } from './middlewares/logger.js';
import { authenticate } from './middlewares/auth.js';

const apiRouter = Router();

apiRouter.get('/data', (req, res) => {
  res.json({  [] });
});

// Apply multiple middleware in order
const protectedApi = new FlexRouter(
  '/api/v1',
  apiRouter,
  [logger, rateLimiter, authenticate] // Applied in this order
);

protectedApi.mount(app, '');
```

### Using Base Paths

You can add a base path when mounting routers, useful for multi-tenant applications:

```javascript
const tenantRouter = Router();

tenantRouter.get('/dashboard', (req, res) => {
  res.json({ tenant: req.params.tenantId });
});

const flexRouter = new FlexRouter('/api', tenantRouter);

// Mount with tenant-specific base path
flexRouter.mount(app, '/tenant/:tenantId');

// Route will be available at: /tenant/:tenantId/api/dashboard
```

### Organizing Routes by Feature

```javascript
// features/users/routes.js
const usersRouter = Router();
usersRouter.get('/', getAllUsers);
usersRouter.post('/', createUser);
export const usersFlexRouter = new FlexRouter('/users', usersRouter);

// features/products/routes.js
const productsRouter = Router();
productsRouter.get('/', getAllProducts);
export const productsFlexRouter = new FlexRouter('/products', productsRouter);

// app.js
import { usersFlexRouter } from './features/users/routes.js';
import { productsFlexRouter } from './features/products/routes.js';

const apiRouters = [usersFlexRouter, productsFlexRouter];

apiRouters.forEach(router => router.mount(app, '/api/v1'));

// Routes available:
// - /api/v1/users
// - /api/v1/products
```

## API

### Constructor

**`new FlexRouter(context, router, handlers?)`**

Creates a new FlexRouter instance.

**Parameters:**
- `context` (string) - The context path for the router (e.g., `/api/v1`)
- `router` (Router) - Express Router instance containing your route definitions
- `handlers` (Array, optional) - Array of middleware handler functions to apply to all routes in this router

**Returns:** FlexRouter instance

### Methods

**`mount(app, basePath)`**

Mounts the router to an Express application with the specified base path.

**Parameters:**
- `app` (Express) - Express application instance
- `basePath` (string) - Base path to prepend to the context path

**Example:**
```javascript
const flexRouter = new FlexRouter('/api', router);
flexRouter.mount(app, '/v1'); // Mounts at /v1/api
```

## Best Practices

1. **Group Related Routes**: Use FlexRouter to group related routes together
2. **Apply Middleware Strategically**: Apply middleware at the FlexRouter level for route groups that share the same requirements
3. **Consistent Naming**: Use consistent naming conventions for context paths (e.g., all lowercase, kebab-case)
4. **Version Your APIs**: Use FlexRouter to manage different API versions easily
5. **Keep Routers Focused**: Each router should handle a specific feature or resource type

## Related Documentation

- [SessionManager](./session-manager.md) - For authentication middleware usage
- [Back to main documentation](../README.md)