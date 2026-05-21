# HTTP Error Handlers Reference

Standardized error handling for Express apps. Six exports cover the full surface:

| Export | Type | Purpose |
|--------|------|---------|
| `httpCodes` | object | Numeric HTTP status code constants |
| `httpMessages` | object | Default text for each code |
| `CustomError` | class | Throwable error with `code`, `message`, `error`, `data` |
| `httpError(code, msg, error?, data?)` | function | Factory shortcut for `new CustomError(...)` |
| `httpErrorHandler` | middleware | 4-arg error middleware — must be last |
| `httpNotFoundHandler` | middleware | Catches unmatched routes — must be just before `httpErrorHandler` |
| `httpHelper` | object | Utility functions: `format`, `toZodMessage`, `handleAxiosError` |

## Status codes available

```
2xx: OK(200), CREATED(201), NO_CONTENT(204)
4xx: BAD_REQUEST(400), UNAUTHORIZED(401), FORBIDDEN(403), NOT_FOUND(404),
     NOT_ACCEPTABLE(406), CONFLICT(409), LOCKED(423)
5xx: SYSTEM_FAILURE(500), NOT_IMPLEMENTED(501)
```

## Required middleware order

```javascript
app.use(express.json());
// ... routes ...
app.use(httpNotFoundHandler);   // emits CustomError(404)
app.use(httpErrorHandler);      // formats CustomError → JSON
```

Reversed order: `httpNotFoundHandler` never runs because Express stops at the first error middleware.

## Standard error response shape

```json
{
  "status": 400,
  "message": "Email is required",
  "field": "email"
}
```

`CustomError.data` entries are merged into the top-level response body. `CustomError.error` is kept for logging/diagnostics and is not serialized by the handler. The handler also sets CORS headers and logs the error to the console via `Logger.getInstance('httpError')`.

## CustomError vs httpError

Functionally identical — `httpError` is just a factory:

```javascript
throw new CustomError(httpCodes.UNAUTHORIZED, 'Invalid credentials');
// equivalent to
throw httpError(httpCodes.UNAUTHORIZED, 'Invalid credentials');
```

Use `httpError` when you'd rather not write `new` everywhere.

## Patterns

### Throw early, catch in async route

```javascript
app.get('/api/users/:id', async (req, res, next) => {
  try {
    const user = await db.findUser(req.params.id);
    if (!user) throw httpError(httpCodes.NOT_FOUND, `User ${req.params.id} not found`);
    res.json(user);
  } catch (e) {
    next(e);   // → httpErrorHandler
  }
});
```

### Convert Axios errors

```javascript
import { httpHelper } from '@igxjs/node-components';

try {
  const r = await axios.get('https://upstream/api/data');
  return r.data;
} catch (e) {
  throw httpHelper.handleAxiosError(e, 'Upstream call failed');
}
```

`handleAxiosError` extracts the upstream status code (when present) and message and wraps both in a `CustomError`.

### Convert Zod validation errors

```javascript
import { z } from 'zod';
import { httpHelper, httpError, httpCodes } from '@igxjs/node-components';

const Schema = z.object({ email: z.string().email() });

app.post('/users', (req, res, next) => {
  try {
    const data = Schema.parse(req.body);
    // ...
  } catch (e) {
    if (e instanceof z.ZodError) {
      return next(httpError(httpCodes.BAD_REQUEST, httpHelper.toZodMessage(e), e));
    }
    next(e);
  }
});
```

### String formatting helper

```javascript
const msg = httpHelper.format('User {0} not found in {1}', email, 'database');
// 'User x@y.com not found in database'
```

Positional `{n}` placeholders. Use it when building error messages from translatable strings; otherwise template literals are simpler.

## Notes

- `httpErrorHandler` accepts both `CustomError` and any other thrown error; generic errors without a `code` field render as `400 BAD_REQUEST` with the original message.
- The handler does not stack-trace unless the underlying error is logged. For dev visibility, your own request logger should log before `httpErrorHandler`.
- `httpCodes.LOCKED` (423) is used by `SessionManager` when refresh locks are active — surface it to clients as a retryable error.
