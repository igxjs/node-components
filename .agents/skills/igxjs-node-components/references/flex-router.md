# FlexRouter Reference

A thin wrapper around `express.Router()` that bundles a context path with shared middleware and exposes a single `mount(app, basePath)` call. Treat `FlexRouter` as a route-module export format: each feature module owns its `new FlexRouter(...)` definitions, and the app entry only imports and mounts those exported definitions.

## Constructor

```javascript
new FlexRouter(context, router, handlers?)
```

- `context` (string): path prepended to every route (e.g., `/api/v1`).
- `router` (`express.Router` instance): your route definitions.
- `handlers` (RequestHandler[], optional): middlewares applied in order before any route in this router.

## mount(app, basePath)

Final route path is `basePath + context + routePath`.

```javascript
const r = new FlexRouter('/api', userRouter);
r.mount(app, '/v1');           // /v1/api/...
r.mount(app, '');              // /api/...
r.mount(app, '/tenant/:id');   // /tenant/:id/api/...
```

## Preferred module pattern

Use `routers` arrays from feature modules. This keeps route ownership near the route definitions and keeps `app.js` focused on application setup.

```javascript
// features/users/routes.js
import { Router } from 'express';
import { FlexRouter } from '@igxjs/node-components';
import { session } from '../../config/session-manager.js';

const usersRouter = Router();
usersRouter.get('/me', (req, res) => res.json({ user: req.user }));

export const routers = [
  new FlexRouter('/users', usersRouter, [
    session.authenticate(),
    session.requireUser(),
  ]),
];
```

```javascript
// app.js
import { routers as userRouters } from './features/users/routes.js';
import { routers as orderRouters } from './features/orders/routes.js';

for (const router of [...userRouters, ...orderRouters]) {
  router.mount(app, '/api/v1');
}
```

For CommonJS projects that can synchronously load `@igxjs/node-components`, export the same shape:

```javascript
module.exports = {
  routers: [
    new FlexRouter('/users', usersRouter, [authenticate, requireUser]),
  ],
};
```

If the consumer is CommonJS on Node 18-22.11, the package must be loaded with dynamic `import()`. In that case, build the `routers` array after the import resolves instead of using a synchronous top-level `require()`.

## Other patterns

### API versioning

```javascript
// features/versioned/routes.js
export const routers = [
  new FlexRouter('/v1', v1Router),
  new FlexRouter('/v2', v2Router),
];

// app.js
versionedRouters.forEach(r => r.mount(app, '/api'));
```

### Mixing public and protected routers

```javascript
import { session } from './config/session-manager.js';

export const routers = [
  new FlexRouter('/public', publicRouter),
  new FlexRouter('/private', privateRouter, [
    session.authenticate(),
    session.requireUser(),
  ]),
];
```

## Notes

- Avoid placing all `new FlexRouter(...)` declarations directly in `app.js`; that makes feature route ownership unclear and leads to duplicated context paths as the app grows.
- Middleware in `handlers` runs before any route matches; it does not run on unmatched paths within the context. Place global middleware (body parsers, request loggers) on `app` directly, not in `FlexRouter`.
- `FlexRouter` does not implement nesting. To nest, mount one router inside another using vanilla `express.Router` and pass the outer router to `FlexRouter`.
