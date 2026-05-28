# @igxjs/node-components — Public API Surface

All exports from `@igxjs/node-components` (re-exported from `index.js`):

```javascript
import {
  // Session
  SessionManager,
  SessionConfig,
  SessionMode,           // { SESSION: 'session', TOKEN: 'token' }
  // Routing
  FlexRouter,
  // JWT (JWE)
  JwtManager,
  // Redis
  RedisManager,
  // Logger
  Logger,
  // HTTP error handling
  httpCodes,
  httpMessages,
  httpError,
  httpErrorHandler,
  httpNotFoundHandler,
  CustomError,
  httpHelper,
} from '@igxjs/node-components';
```

Also exported: `JWTPayload` (re-exported from `jose`).

## Type augmentation (TypeScript)

The package augments two global namespaces — no manual declaration needed:

```typescript
declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    [key: string]: any;
    user?: SessionUser;
  }
}
```

## SessionManager

```typescript
class SessionConfig {
  // UPPERCASE config fields; all fields are optional on the class shape.
}

class SessionManager {
  constructor(config: SessionConfig);
  setup(app: Application): Promise<void>;
  authenticate(errorRedirectUrl?: string): RequestHandler;
  requireUser(): RequestHandler;
  verifySession(errorRedirectUrl?: string): RequestHandler;
  verifyToken(errorRedirectUrl?: string): RequestHandler;
  callback(initUser: (user: SessionUser) => SessionUser): RequestHandler;
  refresh(initUser: (user: SessionUser) => SessionUser): RequestHandler;
  logout(): RequestHandler;
  identityProviders(): RequestHandler;
  getUser(req: Request, includeUserData?: boolean): Promise<Partial<SessionUser> | SessionUser | undefined>;
  getSessionMode(): string;
  redisManager(): RedisManager | null;
  hasLock(email: string): boolean;
  lock(email: string): void;
  clearLocks(): NodeJS.Timeout;
}
```

`SessionConfig` keys (all UPPERCASE):

| Group | Keys |
|-------|------|
| SSO | `SSO_ENDPOINT_URL`, `SSO_APP_ID`, `SSO_JWT_SECRET`, `SSO_SUCCESS_URL`, `SSO_FAILURE_URL` |
| Session | `SESSION_MODE`, `SESSION_AGE`, `SESSION_COOKIE_PATH`, `SESSION_SECRET`, `SESSION_PREFIX`, `SESSION_KEY`, `SESSION_EXPIRY_KEY`, `TOKEN_STORAGE_TEMPLATE_PATH` |
| Redis | `REDIS_URL`, `REDIS_CERT_PATH` |
| JWT | `JWT_ALGORITHM`, `JWT_ENCRYPTION`, `JWT_CLOCK_TOLERANCE`, `JWT_SECRET_HASH_ALGORITHM`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_SUBJECT` |

## FlexRouter

Wraps one `express.Router()` instance with its context path and optional middleware.

```typescript
class FlexRouter {
  context: string;
  router: Router;
  handlers: RequestHandler[];
  constructor(context: string, router: Router, handlers?: RequestHandler[]);
  mount(app: Application, basePath: string): void;
}
```

## JwtManager

```typescript
class JwtManager {
  constructor(options?: JwtManagerOptions);   // UPPERCASE JWT_* keys
  encrypt(data: JWTPayload, input: string, options?: JwtEncryptOptions): Promise<string>;
  decrypt(token: string, input: string, options?: JwtDecryptOptions): Promise<JWTDecryptResult>;
}
```

Constructor (UPPERCASE): `JWT_ALGORITHM`, `JWT_ENCRYPTION`, `JWT_EXPIRATION_TIME`, `JWT_CLOCK_TOLERANCE`, `JWT_SECRET_HASH_ALGORITHM`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_SUBJECT`.

Per-call (camelCase): `algorithm`, `encryption`, `expirationTime`, `secretHashAlgorithm`, `issuer`, `audience`, `subject`, `clockTolerance`.

`expirationTime` accepts a number (seconds) or a string (`'18h'`, `'7d'`, `'30s'`, `'1080m'`).

## RedisManager

```typescript
class RedisManager {
  connect(redisUrl?: string | null, certPath?: string | null): Promise<boolean>;
  getClient(): RedisClientType | null;
  isConnected(): Promise<boolean>;
  disconnect(): Promise<void>;
}
```

Underlying client is `@redis/client` (Node Redis v5+). Use `rediss://` URLs for TLS and pass `certPath`.

## Logger

```typescript
class Logger {
  static getInstance(componentName: string, enableLogging?: boolean): Logger;
  static clearInstances(): void;
  static disableColors(): void;
  static enableColors(): void;
  constructor(componentName: string, enableLogging?: boolean);
  debug(...args: any[]): void;
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  log(...args: any[]): void;
}
```

Default `enableLogging` resolves to `process.env.NODE_ENV !== 'production'`.

## HTTP error handling

```typescript
const httpCodes: {
  OK: 200; CREATED: 201; NO_CONTENT: 204;
  BAD_REQUEST: 400; UNAUTHORIZED: 401; FORBIDDEN: 403;
  NOT_FOUND: 404; NOT_ACCEPTABLE: 406; CONFLICT: 409; LOCKED: 423;
  SYSTEM_FAILURE: 500; NOT_IMPLEMENTED: 501;
};
const httpMessages: { /* matching string for each code */ };

class CustomError extends Error {
  code: number;
  data?: object;
  error?: object;
  constructor(code: number, message: string, error?: Error | object | null, data?: object | null);
}

function httpError(code: number, message: string, error?: Error | object | null, data?: object | null): CustomError;
function httpErrorHandler(err, req, res, next): void;
function httpNotFoundHandler(req, res, next): void;

const httpHelper: {
  format(str: string, ...args: any[]): string;
  toZodMessage(error: any): string;
  handleAxiosError(error: Error | AxiosError, defaultMessage?: string): CustomError;
};
```

Error response shape produced by `httpErrorHandler`:

```json
{
  "status": 400,
  "message": "...",
  "...extraData": "CustomError.data fields are merged at top level"
}
```

## SessionUser shape

```typescript
interface SessionUser {
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  authorized: boolean;
  attributes: {
    idp: string;
    sub: string;
    expires_at: number;
    expires_rt: number;
    access_token: string;
    refresh_token: string;
    groups: string[];
  };
}
```
