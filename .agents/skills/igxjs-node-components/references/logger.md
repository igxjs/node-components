# Logger Reference

Zero-dependency, color-aware, near-zero-overhead logger with a singleton-per-component-name pattern. Used internally by `SessionManager`, `RedisManager`, and `httpErrorHandler`. Adopt it in consumer code when you want consistent prefixed output without pulling in winston/pino.

## API

```javascript
Logger.getInstance(componentName, enableLogging?)   // singleton lookup
Logger.disableColors()                              // global, affects all instances
Logger.enableColors()
Logger.clearInstances()                             // for tests
```

Per-instance: `debug | info | warn | error | log`, all variadic.

## Default enable/disable

`enableLogging` defaults to `process.env.NODE_ENV !== 'production'`. Override per logger:

```javascript
Logger.getInstance('Critical', true);    // always logs
Logger.getInstance('Noisy',   false);    // always silent
Logger.getInstance('Standard');          // dev=on, prod=off
```

## Color decisions

Colors are emitted only if **all** are true:
1. Global flag is true (default; toggled via `Logger.disableColors()`)
2. `process.stdout.isTTY` is true
3. `process.env.NO_COLOR` is unset

When stdout is piped to a file or `NO_COLOR=1` is set, output is plain text — no special handling needed in consumer code.

| Method | ANSI |
|--------|------|
| `debug` | dim/gray |
| `info` | cyan |
| `warn` | yellow |
| `error` | red |
| `log` | default |

## Singleton semantics

The cache key is `componentName + enableLogging`. Same name + same flag returns the same instance:

```javascript
Logger.getInstance('A')        === Logger.getInstance('A')        // true
Logger.getInstance('A')        === Logger.getInstance('A', true)  // false (different key)
Logger.getInstance('A')        === Logger.getInstance('B')        // false
```

Pick a stable component name and don't switch the flag in different call sites for the same component.

## Performance

Methods are assigned once in the constructor:
- enabled → bound `console.*` calls
- disabled → no-op `() => {}`

There's no per-call `if (enabled)` check, so disabled loggers are free even on hot paths. But: arguments are still evaluated. Don't pre-stringify expensive objects:

```javascript
logger.debug('Big object:', JSON.stringify(big));   // ❌ runs even when disabled
logger.debug('Big object:', big);                   // ✅ stringification only happens if enabled
```

## Idiomatic placement

```javascript
// class field
class UserService {
  #logger = Logger.getInstance('UserService');
  // ...
}

// module-level
const logger = Logger.getInstance('AuthMiddleware');
```

Avoid `new Logger(...)` directly — use `getInstance` so caching works.

## Testing

```javascript
// Quiet test output
beforeAll(() => Logger.disableColors());

// Reset between tests if you mutate logger state
afterEach(() => Logger.clearInstances());

// Spy on a logger
const log = Logger.getInstance('UnderTest');
const errSpy = jest.spyOn(log, 'error');
```
