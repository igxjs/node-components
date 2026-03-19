# System Patterns: @igxjs/node-components

## Architecture Overview

### Component-Based Design
The library follows a modular, component-based architecture where each component is:
- **Independent** - Can be used standalone or combined
- **Self-contained** - Encapsulates its own logic and dependencies
- **Configurable** - Smart defaults with customization options
- **Production-ready** - Error handling, logging, and edge cases covered

### Component Hierarchy
```
@igxjs/node-components
├── SessionManager (complex - depends on RedisManager, JwtManager)
├── JwtManager (independent)
├── RedisManager (independent)
├── FlexRouter (independent)
├── Logger (independent)
└── HTTP Handlers (independent - utility functions)
```

## Key Technical Decisions

### 1. ES Modules Over CommonJS
**Decision**: Use ES modules (`type: "module"`)
**Rationale**:
- Modern Node.js standard (18+)
- Better tree-shaking for consumers
- Cleaner import/export syntax
- Future-proof

**Implementation**:
```javascript
// All files use ES module syntax
export class JwtManager { }
export { SessionManager } from './components/session.js';
```

### 2. Class-Based Components with Singleton Pattern
**Decision**: Use classes for managers, instantiated once per application
**Rationale**:
- Clear state management
- Easy configuration through constructor
- Singleton prevents duplicate Redis connections
- Instance methods are more intuitive than static methods

**Pattern**:
```javascript
// Manager class with configuration
export class SessionManager {
  constructor(options = {}) {
    // Configuration stored as instance properties
    this.mode = options.SESSION_MODE || SessionMode.SESSION;
  }
  
  // Instance methods
  async setup(app) { }
  authenticate() { }
}

// User creates singleton instance
export const session = new SessionManager(config);
```

### 3. SCREAMING_SNAKE_CASE for Constructor Options
**Decision**: Constructor parameters use UPPERCASE naming (e.g., `JWT_ALGORITHM`, `SESSION_SECRET`)
**Rationale**:
- Matches environment variable conventions
- Clear distinction from method parameters
- Easy to map from `process.env`
- Prevents confusion with method-level options

**Pattern**:
```javascript
// Constructor: SCREAMING_SNAKE_CASE
constructor(options = {}) {
  this.algorithm = options.JWT_ALGORITHM || 'dir';
  this.secret = options.SESSION_SECRET;
}

// Methods: camelCase parameters
async encrypt(data, secret, options = {}) {
  const algorithm = options.algorithm ?? this.algorithm;
}
```

### 4. Async/Await Throughout
**Decision**: All asynchronous operations use async/await
**Rationale**:
- Cleaner error handling
- More readable than promises
- Standard modern Node.js practice
- Easier to debug

**Pattern**:
```javascript
async encrypt(data, secret) {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return await jwt.encrypt(new Uint8Array(hash));
}
```

### 5. Comprehensive JSDoc Documentation
**Decision**: Every public method has JSDoc with types and examples
**Rationale**:
- IDE autocomplete support
- Type checking without TypeScript
- Clear API documentation
- Examples in the code

**Pattern**:
```javascript
/**
 * Generate JWT token for user session
 * 
 * @param {import('jose').JWTPayload} data User data payload
 * @param {string} secret Secret key or password for encryption
 * @param {JwtEncryptOptions} [options] Per-call configuration overrides
 * @returns {Promise<string>} Returns encrypted JWT token
 */
async encrypt(data, secret, options = {}) { }
```

## Design Patterns in Use

### 1. Singleton Pattern (Manager Classes)
**Usage**: SessionManager, RedisManager
**Why**: Prevent duplicate connections, shared state
**Example**:
```javascript
// User creates ONE instance per application
export const session = new SessionManager(config);

// Reused throughout application
app.use(session.authenticate());
```

### 2. Factory Pattern (Middleware Creation)
**Usage**: SessionManager.authenticate(), FlexRouter.mount()
**Why**: Create configured middleware functions
**Example**:
```javascript
authenticate() {
  return async (req, res, next) => {
    // Middleware logic using instance config
    if (this.mode === SessionMode.SESSION) { }
  };
}
```

### 3. Strategy Pattern (Authentication Modes)
**Usage**: SessionManager with SESSION vs TOKEN modes
**Why**: Different authentication strategies with same interface
**Example**:
```javascript
constructor(options) {
  this.mode = options.SESSION_MODE || SessionMode.SESSION;
}

// Different behavior based on mode
authenticate() {
  if (this.mode === SessionMode.SESSION) {
    return this.verifySession();
  } else {
    return this.verifyToken();
  }
}
```

### 4. Adapter Pattern (Redis Integration)
**Usage**: RedisManager wraps Redis client
**Why**: Simplify Redis connection, add TLS/reconnection
**Example**:
```javascript
class RedisManager {
  async connect() {
    // Handles TLS, URL parsing, reconnection
    this.client = await createClient(config);
  }
}
```

### 5. Middleware Chain Pattern (FlexRouter)
**Usage**: FlexRouter combines routes with middleware
**Why**: Flexible mounting with context paths
**Example**:
```javascript
new FlexRouter(contextPath, router, [middleware1, middleware2]);
```

## Component Relationships

### SessionManager (Complex)
**Dependencies**:
- `RedisManager` (optional) - Session storage
- `JwtManager` (token mode) - Token encryption
- `express-session` - Session middleware
- `axios` - SSO HTTP calls

**Responsibilities**:
- SSO authentication flow
- Session/token management
- User data transformation
- Logout handling

### JwtManager (Independent)
**Dependencies**: 
- `jose` - JWT encryption
- `node:crypto` - Key derivation

**Responsibilities**:
- JWT encryption (JWE)
- JWT decryption
- Token validation

### RedisManager (Independent)
**Dependencies**:
- `@redis/client` - Redis connection

**Responsibilities**:
- Redis connection
- TLS certificate handling
- Auto-reconnection

### FlexRouter (Independent)
**Dependencies**:
- `express.Router` - Express routing

**Responsibilities**:
- Context path mounting
- Middleware attachment
- Route composition

### Logger (Independent)
**Dependencies**: None (zero-dependency)

**Responsibilities**:
- Colorized logging
- Smart TTY detection
- Minimal overhead

### HTTP Handlers (Utilities)
**Dependencies**: None

**Responsibilities**:
- Error code constants
- Error formatting
- Standard error handlers

## Critical Implementation Paths

### 1. Session-Based Authentication Flow
```
User Request
  → Express app.use(session.authenticate())
  → Check session cookie
  → If valid: load user from session → req.user = user
  → If invalid: redirect to SSO
  → SSO callback: session.callback()
  → Store user in Redis session
  → Redirect to app
```

### 2. Token-Based Authentication Flow
```
User Request
  → Express app.use(session.verifyToken())
  → Extract Bearer token from Authorization header
  → Decrypt JWT token
  → Validate expiry, claims
  → Load user data from token → req.user = payload
  → If expired: attempt refresh
  → If refresh fails: return 401
```

### 3. Redis Connection Lifecycle
```
App Start
  → RedisManager.connect()
  → Parse REDIS_URL
  → Load TLS certificate (if provided)
  → Create Redis client
  → Set up reconnection handlers
  → Test connection
  → Return connected client
```

### 4. JWT Encryption Flow
```
User Data
  → Derive key from secret (SHA-256 hash)
  → Create EncryptJWT with payload
  → Set headers (alg, enc, typ)
  → Set timestamps (iat, exp)
  → Set optional claims (iss, aud, sub)
  → Encrypt with derived key
  → Return JWE token string
```

## Error Handling Patterns

### 1. Try-Catch with Fallbacks
```javascript
try {
  await redis.connect();
} catch (error) {
  console.warn('Redis unavailable, using memory store');
  this.useMemoryStore();
}
```

### 2. Middleware Error Propagation
```javascript
authenticate() {
  return async (req, res, next) => {
    try {
      // Authentication logic
    } catch (error) {
      next(httpError(httpCodes.UNAUTHORIZED, 'Auth failed', error));
    }
  };
}
```

### 3. Custom Error Classes
```javascript
class CustomError extends Error {
  constructor(code, message, originalError) {
    super(message);
    this.code = code;
    this.originalError = originalError;
  }
}
```

## Export Pattern

### Centralized Exports via index.js
**Pattern**: All components exported from single entry point
**Why**: Clean imports for consumers, easy to discover components

```javascript
// index.js - Central export point
export { SessionManager, SessionMode } from './components/session.js';
export { JwtManager } from './components/jwt.js';
export { RedisManager } from './components/redis.js';
// ... etc

// Consumer usage
import { SessionManager, JwtManager } from '@igxjs/node-components';
```

## Testing Patterns

### Unit Tests with Mocha/Chai
```javascript
describe('JwtManager', () => {
  it('should encrypt and decrypt JWT token', async () => {
    const jwt = new JwtManager();
    const token = await jwt.encrypt({ userId: '