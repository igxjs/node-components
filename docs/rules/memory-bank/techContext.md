# Tech Context: @igxjs/node-components

## Technologies Used

### Core Runtime
- **Node.js >= 18** - Required for ES modules, Web Crypto API, modern features
- **ES Modules** - Modern module system (`type: "module"`)
- **JavaScript (ES2022)** - No TypeScript source, but includes .d.ts definitions

### Primary Framework
- **Express.js** - Web framework for routing and middleware
  - Version: ^5.x (compatible with 4.x)
  - Used in: SessionManager, FlexRouter, HTTP Handlers

### Key Dependencies

#### Authentication & Security
- **jose** (^6.2.1) - JWT encryption using JWE standards
  - Used in: JwtManager
  - Purpose: Secure JWT encryption/decryption
  - Key Features: JWE support, modern cryptography

- **express-session** (^1.19.0) - Session middleware
  - Used in: SessionManager (SESSION mode)
  - Purpose: Cookie-based session management
  - Storage: Redis or memory

#### Redis Integration
- **@redis/client** (^5.11.0) - Official Redis client
  - Used in: RedisManager, SessionManager
  - Purpose: Session storage, data caching
  - Features: TLS support, auto-reconnection

- **connect-redis** (^9.0.0) - Redis session store adapter
  - Used in: SessionManager
  - Purpose: Bridge express-session to Redis

- **memorystore** (^1.6.7) - Memory-based session store
  - Used in: SessionManager (fallback)
  - Purpose: Session storage when Redis unavailable

#### HTTP Client
- **axios** (^1.13.6) - HTTP client
  - Used in: SessionManager
  - Purpose: SSO API calls, token refresh

### Development Dependencies

#### Testing
- **mocha** (^12.0.0-beta-10) - Test framework
- **chai** (^6.2.2) - Assertion library
- **sinon** (^21.0.3) - Mocking/stubbing
- **supertest** (^7.0.0) - HTTP assertions

#### Type Definitions
- **@types/express** (^5.0.6) - Express TypeScript types

## Development Setup

### Prerequisites
```bash
# Required
Node.js >= 18
npm >= 9

# Optional (for testing)
Redis server (local or remote)
```

### Installation
```bash
npm install @igxjs/node-components
```

### Development Installation
```bash
git clone https://github.com/igxjs/node-components.git
cd node-components
npm install
```

### Running Tests
```bash
npm test  # Runs mocha tests with 5s timeout
```

### Project Structure
```
node-components/
├── components/          # Component source files
│   ├── session.js       # SessionManager
│   ├── jwt.js          # JwtManager
│   ├── redis.js        # RedisManager
│   ├── router.js       # FlexRouter
│   ├── logger.js       # Logger
│   ├── http-handlers.js # HTTP utilities
│   └── assets/         # Templates
├── tests/              # Unit tests
│   ├── session.test.js
│   ├── jwt.test.js
│   ├── redis.test.js
│   └── ...
├── docs/               # Documentation
│   ├── README.md
│   ├── session-manager.md
│   ├── jwt-manager.md
│   └── ...
├── index.js            # Main entry point
├── index.d.ts          # TypeScript definitions
├── package.json
└── README.md
```

## Technical Constraints

### Node.js Version
- **Minimum**: 18.0.0
- **Reason**: Web Crypto API (`crypto.subtle`), ES modules maturity
- **Impact**: Cannot use older Node.js versions

### Module System
- **Format**: ES modules only (no CommonJS)
- **Constraint**: Consumers must support ES modules
- **File Extension**: All `.js` files are ES modules

### Express Compatibility
- **Versions**: Compatible with Express 4.x and 5.x
- **Middleware**: Standard Express middleware pattern
- **No Breaking Changes**: Works with existing Express apps

### Redis (Optional)
- **Requirement**: Optional, not required
- **Fallback**: Uses memory store if Redis unavailable
- **TLS**: Supports TLS connections with custom certificates
- **Version**: Compatible with Redis 5+

### TypeScript
- **Source**: Written in JavaScript
- **Definitions**: `.d.ts` file included
- **Constraint**: Type definitions maintained manually

## Tool Usage Patterns

### Package Management
```bash
# Install dependencies
npm install

# Run tests
npm test

# Publish (maintainers only)
npm version [patch|minor|major]
npm publish
```

### Testing Strategy
```javascript
// Test structure
describe('Component', () => {
  describe('method', () => {
    it('should do something', async () => {
      // Arrange
      const component = new Component(config);
      
      // Act
      const result = await component.method();
      
      // Assert
      expect(result).to.equal(expected);
    });
  });
});
```

### Mocking with Sinon
```javascript
// Mock external dependencies
const stub = sinon.stub(axios, 'post').resolves({  mockData });

// Test with mock
await sessionManager.refresh();

// Verify and restore
expect(stub.calledOnce).to.be.true;
stub.restore();
```

### Redis Testing
```javascript
// Tests handle Redis unavailability
it('should fallback to memory store if Redis fails', async () => {
  // Mock Redis connection failure
  const redisStub = sinon.stub(RedisManager.prototype, 'connect')
    .rejects(new Error('Redis unavailable'));
  
  // Session manager should still work
  const session = new SessionManager({ REDIS_URL: 'redis://invalid' });
  await session.setup(app);
  
  // Should use memory store
  expect(session.store).to.be.instanceOf(MemoryStore);
});
```

## Environment Variables

### Required for SSO
```bash
SSO_ENDPOINT_URL=https://sso.example.com
SSO_CLIENT_ID=your-client-id
SSO_CLIENT_SECRET=your-client-secret
SESSION_SECRET=your-session-secret
```

### Optional
```bash
# Redis (if using)
REDIS_URL=redis://localhost:6379
REDIS_CERT_PATH=/path/to/cert.pem

# Token mode
SSO_SUCCESS_URL=/dashboard
SSO_FAILURE_URL=/login

# JWT customization
JWT_ALGORITHM=dir
JWT_ENCRYPTION=A256GCM
JWT_ISSUER=https://yourapp.com
JWT_AUDIENCE=https://yourapp.com
JWT_SUBJECT=user-auth
```

## Build & Distribution

### npm Package
- **Name**: `@igxjs/node-components`
- **Access**: Public
- **Registry**: npmjs.com
- **License**: Apache 2.0

### Published Files
```json
"files": [
  "index.js",
  "index.d.ts",
  "components/",
  "LICENSE",
  "README.md"
]
```

### Version Strategy
- **Semantic Versioning** (semver)
- **Breaking Changes**: Major version bump
- **New Features**: Minor version bump
- **Bug Fixes**: Patch version bump

## Performance Considerations

### Redis Connection Pooling
- Single Redis connection per SessionManager instance
- Connection reused across all requests
- Auto-reconnection on disconnect

### JWT Encryption
- Key derivation cached per instance
- Encryption happens once per login
- Decryption on every protected route request

### Session Storage
- Redis: Fast, distributed, persistent
- Memory: Fastest, but non-persistent
- Trade-off: Choose based on requirements

### Logging
- Zero-dependency logger
- Minimal overhead
- Color detection cached

## Security Best Practices

### JWT Encryption
- **JWE** (encrypted JWT), not just JWT (signed)
- **Key Derivation**: SHA-256 hash of secret
- **Clock Tolerance**: 30s default for time skew

### Session Security
- **HTTP-Only Cookies**: Prevents XSS access
- **Secure Flag**: HTTPS-only in production
- **SameSite**: CSRF protection
- **Session Expiry**: Configurable timeout

### Redis Security
- **TLS Support**: Encrypted connections
- **Authentication**: Redis password support
- **Network**: Private network recommended

### SSO Security
- **HTTPS Only**: All SSO endpoints must use HTTPS
- **Token Refresh**: Automatic token refresh logic
- **Logout**: Proper session/token cleanup