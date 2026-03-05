# SessionManager

Provides SSO (Single Sign-On) session management with support for Redis and memory-based session stores.

## Configuration Options

```javascript
// Example configuration object
// All fields are strings except SESSION_AGE which is a number

const config = {
  // SSO Configuration
  SSO_ENDPOINT_URL: 'https://sso.example.com',
  SSO_CLIENT_ID: 'your-client-id',
  SSO_CLIENT_SECRET: 'your-client-secret',
  SSO_SUCCESS_URL: '/dashboard',
  SSO_FAILURE_URL: '/login',
  
  // Session Configuration
  SESSION_AGE: 64800000, // 18 hours in milliseconds
  SESSION_COOKIE_PATH: '/',
  SESSION_SECRET: 'your-session-secret',
  SESSION_PREFIX: 'ibmid:',  // Default value when not provided
  
  // Redis Configuration (optional - uses memory store if not provided)
  REDIS_URL: 'redis://localhost:6379',
  REDIS_CERT_PATH: '/path/to/cert.pem' // For TLS connections
};
```

## ⚠️ Important: Singleton Pattern

**SessionManager should be instantiated once and exported as a singleton.** 

**Why?**
- SessionManager manages Redis connections (if configured)
- Multiple instances can lead to connection pool exhaustion
- Session state consistency requires a single source of truth
- Middleware functions need to reference the same instance

**✅ Recommended:** Create a separate module that exports a single SessionManager instance  
**❌ Avoid:** Creating new SessionManager instances in multiple files

## Recommended File Structure

```
your-project/
├── src/
│   ├── config/
│   │   └── session-manager.js  ← Create SessionManager singleton here
│   ├── routes/
│   │   └── auth.js             ← Import session from config
│   └── app.js                  ← Import and setup session
└── package.json
```

## Usage Example

### Step 1: Create SessionManager Singleton

Create a dedicated file for your SessionManager instance:

```javascript
// config/session-manager.js
import { SessionManager } from '@igxjs/node-components';

// Create and export a single SessionManager instance
export const session = new SessionManager({
  SSO_ENDPOINT_URL: process.env.SSO_ENDPOINT_URL,
  SSO_CLIENT_ID: process.env.SSO_CLIENT_ID,
  SSO_CLIENT_SECRET: process.env.SSO_CLIENT_SECRET,
  SSO_SUCCESS_URL: '/dashboard',
  SSO_FAILURE_URL: '/login',
  SESSION_AGE: 64800000, // 18 hours in milliseconds
  SESSION_COOKIE_PATH: '/',
  SESSION_SECRET: process.env.SESSION_SECRET,
  SESSION_PREFIX: 'ibmid:',
  REDIS_URL: process.env.REDIS_URL,
  REDIS_CERT_PATH: process.env.REDIS_CERT_PATH
});
```

### Step 2: Setup and Use in Your Application

Import and use the singleton instance throughout your application:

```javascript
// app.js or index.js
import express from 'express';
import { session } from './config/session-manager.js';

const app = express();

// Initialize session middleware (call once during app startup)
await session.setup(app, (user) => {
  // Process user object - compute permissions, avatar URL, etc.
  return {
    ...user,
    displayName: user.email?.split('@')[0],
    hasAdminAccess: user.authorized && user.email?.endsWith('@admin.com')
  };
});

// Use session instance in your routes
app.get('/protected', session.authenticate(), (req, res) => {
  res.json({ user: req.user });
});

app.get('/auth/callback', session.callback((user) => {
  return {
    ...user,
    loginTime: new Date()
  };
}));

app.get('/auth/providers', session.identityProviders());
app.post('/auth/refresh', session.refresh((user) => {
  return { ...user, refreshedAt: new Date() };
}));
app.get('/auth/logout', session.logout());

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Step 3: Import in Other Files

```javascript
// routes/auth.js
import { Router } from 'express';
import { session } from '../config/session-manager.js';

const router = Router();

// Reuse the same session instance
router.get('/profile', session.authenticate(), (req, res) => {
  res.json({ profile: req.user });
});

export default router;
```

## API Methods

- **`setup(app, updateUser)`** - Initialize session configurations
- **`authenticate(isDebugging?, redirectUrl?)`** - Resource protection middleware
- **`callback(initUser)`** - SSO callback handler for successful login
- **`identityProviders()`** - Get available identity providers
- **`logout()`** - Application logout handler (not SSO logout)
- **`refresh(initUser)`** - Refresh user session with new token
- **`redisManager()`** - Get the RedisManager instance (returns RedisManager or null)
- **`hasLock(email)`** - Check if email has a session refresh lock
- **`lock(email)`** - Lock email for session refresh (prevents concurrent refreshes)
- **`clearLocks()`** - Clear expired session refresh locks

## Related Documentation

- [RedisManager](./redis-manager.md) - Used internally by SessionManager for Redis storage
- [Back to main documentation](../README.md)