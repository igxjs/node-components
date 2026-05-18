# FlexRouter Reference

A thin wrapper around `express.Router()` that bundles a context path with shared middleware and exposes a single `mount(app, basePath)` call.

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

## Patterns

### API versioning

```javascript
const v1 = new FlexRouter('/api/v1', v1Router);
const v2 = new FlexRouter('/api/v2', v2Router);
[v1, v2].forEach(r => r.mount(app, ''));
```

### Mixing public and protected routers

```javascript
import { session } from './config/session-manager.js';

new FlexRouter('/api/public', publicRouter).mount(app, '');
new FlexRouter('/api/private', privateRouter, [
  session.authenticate(),
  session.requireUser(),
]).mount(app, '');
```

### Feature-scoped exports

Each feature module exports its own `FlexRouter`; the entry file mounts them in a loop. Keeps `app.js` short and avoids context-path duplication across files.

```javascript
// features/users/index.js
export const usersRouter = new FlexRouter('/users', userExpressRouter);

// app.js
[usersRouter, productsRouter, ordersRouter].forEach(r => r.mount(app, '/api/v1'));
```

## Notes

- Middleware in `handlers` runs before any route matches; it does not run on unmatched paths within the context. Place global middleware (body parsers, request loggers) on `app` directly, not in `FlexRouter`.
- `FlexRouter` does not implement nesting. To nest, mount one router inside another using vanilla `express.Router` and pass the outer router to `FlexRouter`.
