# FlexRouter Reference

A thin one-to-one wrapper around a single `express.Router()` instance. It bundles that router's context path with optional router-specific middleware and exposes a single `mount(app, basePath)` call.

Use one `FlexRouter` per Express router. A module may export many `FlexRouter` entries, but each entry should wrap exactly one `express.Router()` instance.

## Constructor

```javascript
new FlexRouter(context, router, handlers?)
```

- `context` (string): router-specific mount path, prepended to every route it owns (e.g., `/public` or `/users`).
- `router` (`express.Router` instance): one Express router instance containing this route group.
- `handlers` (RequestHandler[], optional): middlewares applied in order before any route in this router.

## mount(app, basePath)

Final route path is `basePath + context + routePath`.

```javascript
const r = new FlexRouter('/users', userRouter);
r.mount(app, '/api/v1');       // /api/v1/users/...

const tenantRouter = new FlexRouter('/users', userRouter);
tenantRouter.mount(app, '/tenant/:id/api/v1'); // /tenant/:id/api/v1/users/...
```

## Module pattern

Use `routers` arrays from route modules. This keeps route ownership near the route definitions and keeps `app.js` focused on application setup. If a file declares multiple Express routers, export one `FlexRouter` entry for each router.

```javascript
// features/api/routes.js
import { Router } from 'express';
import { FlexRouter } from '@igxjs/node-components';
import { session } from '../../config/session-manager.js';

const publicRouter = Router();
const privateRouter = Router();

publicRouter.get('/health', (_req, res) => res.json({ ok: true }));
privateRouter.get('/me', (req, res) => res.json({ user: req.user }));

export const routers = [
  new FlexRouter('/public', publicRouter),
  new FlexRouter('/protected', privateRouter, [
    session.authenticate(),
    session.requireUser(),
  ]),
];
```

```javascript
// app.js
import { routers as apiRouters } from './features/api/routes.js';

for (const router of apiRouters) {
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

If the consumer is CommonJS on Node 22.0-22.11, the package must be loaded with dynamic `import()`. In that case, build the `routers` array after the import resolves instead of using a synchronous top-level `require()`. Node versions below 22 are unsupported by the package.

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

- `mount(app, basePath)` always concatenates `basePath + context`; prefer a real shared prefix such as `mount(app, '/api/v1')` when one exists. Use `mount(app, '')` only when there is intentionally no shared prefix.
- Avoid creating a single `FlexRouter` for multiple Express routers. If middleware differs between public and protected routes, use separate Express routers and separate `FlexRouter` entries.
- Middleware in `handlers` runs before any route matches; it does not run on unmatched paths within the context. Place global middleware (body parsers, request loggers) on `app` directly, not in `FlexRouter`.
- `FlexRouter` does not implement nesting. To nest, mount one router inside another using vanilla `express.Router` and pass the outer router to `FlexRouter`.
