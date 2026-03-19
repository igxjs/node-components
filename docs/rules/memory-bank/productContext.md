# Product Context: @igxjs/node-components

## Why This Library Exists

### Problem Statement
Enterprise Node.js applications often require:
1. **SSO Integration** - Complex authentication flows with enterprise identity providers
2. **Dual Authentication Modes** - Both session-based (cookies) and token-based (JWT) authentication
3. **Session Management** - Reliable session storage with Redis or memory fallback
4. **Standardized Patterns** - Consistent error handling, routing, and logging across microservices
5. **Production Readiness** - Battle-tested components with proper error handling and reconnection logic

### Current Pain Points
Without this library, developers must:
- Implement SSO integration from scratch for each project
- Handle session storage complexity (Redis connections, failover, etc.)
- Write custom JWT encryption/decryption logic
- Create custom error handling patterns
- Manage Redis connections manually
- Build routing utilities repeatedly

### Solution
A production-ready component library that provides:
- **Plug-and-play SSO** with configurable dual authentication modes
- **Managed Sessions** with Redis support and automatic failover
- **Secure JWT** encryption using JWE standards
- **Flexible Routing** with context paths and middleware
- **Standardized Errors** with HTTP status codes and messages
- **Reliable Redis** connections with TLS and auto-reconnection

## How It Should Work

### Design Philosophy
1. **Minimal Configuration** - Smart defaults, configure only what's needed
2. **Production First** - Handle edge cases, errors, and reconnections properly
3. **Developer Friendly** - Clear APIs, comprehensive docs, helpful error messages
4. **Framework Agnostic** - Works with any Express.js application
5. **Type Safe** - TypeScript definitions included

### User Experience Goals

#### For Developers
- **Quick Start**: `npm install`, configure 3-4 environment variables, ready to go
- **Clear Documentation**: Every component has examples and API docs
- **Predictable Behavior**: Consistent patterns across all components
- **Easy Debugging**: Helpful error messages and optional logging

#### For Applications
- **Reliable**: Handles failures gracefully (Redis down, SSO timeout, etc.)
- **Secure**: Follows security best practices (encrypted JWT, secure sessions)
- **Performant**: Minimal overhead, efficient Redis usage
- **Scalable**: Works in distributed environments (multiple instances)

### Key Use Cases

#### 1. Session-Based SSO Authentication
```javascript
const session = new SessionManager({
  SSO_ENDPOINT_URL: process.env.SSO_ENDPOINT_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  REDIS_URL: process.env.REDIS_URL
});
await session.setup(app);
app.get('/protected', session.authenticate(), handler);
```

#### 2. Token-Based SSO Authentication
```javascript
const session = new SessionManager({
  SESSION_MODE: SessionMode.TOKEN,
  SSO_ENDPOINT_URL: process.env.SSO_ENDPOINT_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  REDIS_URL: process.env.REDIS_URL
});
await session.setup(app);
app.get('/api/data', session.verifyToken(), handler);
```

#### 3. Flexible Routing
```javascript
const flexRouter = new FlexRouter('/api/v1', router, [authMiddleware]);
flexRouter.mount(app, '');
```

#### 4. JWT Management
```javascript
const jwt = new JwtManager({ SESSION_AGE: 64800000 });
const token = await jwt.encrypt(payload, secret);
const { payload: data } = await jwt.decrypt(token, secret);
```

## Problems This Solves

### 1. SSO Integration Complexity
**Before**: 100+ lines of boilerplate for SSO flow, callback handling, token refresh
**After**: 5 lines of configuration

### 2. Session Storage Management
**Before**: Manual Redis setup, connection handling, failover logic
**After**: Automatic Redis integration with memory fallback

### 3. Authentication Mode Switching
**Before**: Different implementations for cookies vs. JWT tokens
**After**: Single config option switches between modes

### 4. Token Security
**Before**: JWT signing with shared secrets (less secure)
**After**: JWE encryption with proper key derivation

### 5. Error Handling Consistency
**Before**: Each route defines custom error responses
**After**: Standardized error codes and handlers

### 6. Redis Reliability
**Before**: Manual reconnection logic, TLS certificate handling
**After**: Built-in reconnection with TLS support

## Success Metrics

### Developer Experience
- Time to integrate SSO: < 30 minutes
- Configuration complexity: < 10 options required
- Documentation clarity: All use cases covered with examples

### Production Readiness
- Error recovery: Automatic reconnection for Redis
- Security: JWE encryption, secure session cookies
- Reliability: Graceful degradation when Redis unavailable

### Adoption
- npm downloads: Growing usage
- GitHub stars: Community validation
- Issue resolution: Fast response to bugs/questions