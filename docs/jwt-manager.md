# JWT Manager

Provides JWT (JSON Web Token) encryption and decryption utilities using the `jose` library with JWE (JSON Web Encryption) for secure token management.

## Overview

JwtManager provides secure token-based authentication using:
- JWE (JSON Web Encryption) for encrypted tokens
- Configurable expiration times
- Standard JWT claims (issuer, audience, subject)
- Clock tolerance for time synchronization issues
- Easy integration with Express.js applications

## Configuration Options

### Constructor Options

Constructor options use `JWT_` prefix with UPPERCASE naming convention:

```javascript
const jwtOptions = {
  JWT_ALGORITHM: 'dir',              // JWE algorithm (default: 'dir')
  JWT_ENCRYPTION: 'A256GCM',         // JWE encryption method (default: 'A256GCM')
  JWT_EXPIRATION_TIME: '10m',        // Token expiration (default: '10m')
  JWT_CLOCK_TOLERANCE: 30,           // Clock tolerance in seconds (default: 30)
  JWT_SECRET_HASH_ALGORITHM: 'SHA-256', // Hash algorithm for secret derivation (default: 'SHA-256')
  JWT_ISSUER: 'your-app',            // Optional JWT issuer claim
  JWT_AUDIENCE: 'your-users',        // Optional JWT audience claim
  JWT_SUBJECT: 'user-session'        // Optional JWT subject claim
};
```

### encrypt() Method Options

Per-call encryption options use camelCase naming convention:

```javascript
const encryptOptions = {
  algorithm: 'dir',              // JWE algorithm (overrides constructor default)
  encryption: 'A256GCM',         // JWE encryption method
  expirationTime: '1h',          // Token expiration time
  clockTolerance: 30,            // Clock tolerance for validation
  secretHashAlgorithm: 'SHA-256' // Hash algorithm for secret derivation
};

// Add optional JWT claims
encryptOptions.issuer = 'my-app';
encryptOptions.audience = 'my-users';
```

### decrypt() Method Options

Per-call decryption options use camelCase naming convention:

```javascript
const decryptOptions = {
  clockTolerance: 30,            // Clock tolerance for validation (default: 30)
  issuer: 'my-app',              // Expected issuer claim for validation
  audience: 'my-users',          // Expected audience claim for validation
  subject: 'user-session'        // Expected subject claim for validation
};
```

## Basic Usage

```javascript
import { JwtManager } from '@igxjs/node-components';

// Create instance with default configuration using constructor options (JWT_ prefix)
const jwtManager = new JwtManager({
  JWT_EXPIRATION_TIME: '1h',
  JWT_ISSUER: 'my-app',
  JWT_AUDIENCE: 'my-users'
});

// Encrypt user data - encrypt method uses camelCase for per-call options
const userData = {
  userId: '12345',
  email: 'user@example.com',
  roles: ['admin', 'user']
};

const secret = 'your-secret-key';

// Encrypt with default settings
const token = await jwtManager.encrypt(userData, secret);

console.log('Encrypted Token:', token);

// Encrypt with custom per-call options (camelCase)
const shortExpiryToken = await jwtManager.encrypt(userData, secret, {
  expirationTime: '1m',        // Override default expiration time
  issuer: 'temporary-issuer'    // Temporary issuer for this token
});

// Decrypt token - decrypt method uses camelCase for per-call options
try {
  const result = await jwtManager.decrypt(token, secret);
  console.log('Decrypted Payload:', result.payload);
  console.log('Protected Header:', result.protectedHeader);
} catch (error) {
  console.error('Token validation failed:', error);
}

// Decrypt with custom options (camelCase)
const decryptedResult = await jwtManager.decrypt(token, secret, {
  clockTolerance: 60,          // Extended clock tolerance
  issuer: 'my-app'             // Validate against specific issuer
});
```

## API Reference

### Constructor

**`new JwtManager(options?)`**

Create a new JwtManager instance. All options are optional with sensible defaults. Constructor options use UPPERCASE naming convention with JWT_ prefix.

**Parameters:**
- `options` (JwtManagerOptions, optional) - Configuration options using JWT_ prefixed properties

### Methods

#### `encrypt(data, input, options?)`

Generate an encrypted JWT token.

**Parameters:**
- `data` (JWTPayload) - User data payload to encrypt
- `input` (string) - Secret key or password for encryption
- `options` (JwtEncryptOptions, optional) - Per-call configuration overrides using camelCase properties

**Returns:** `Promise<string>` - Encrypted JWT token

#### `decrypt(token, input, options?)`

Decrypt and validate a JWT token.

**Parameters:**
- `token` (string) - JWT token to decrypt
- `input` (string) - Secret key or password for decryption
- `options` (JwtDecryptOptions, optional) - Per-call configuration overrides using camelCase properties

**Returns:** `Promise<JWTDecryptResult>` - Object containing `payload` and `protectedHeader`

## Configuration Details

### Algorithms
- `'dir'` (default) - Direct encryption with shared symmetric key
- `'A128KW'`, `'A192KW'`, `'A256KW'` - AES Key Wrap algorithms

### Encryption Methods
- `'A256GCM'` (default) - AES-GCM with 256-bit key
- `'A128GCM'`, `'A192GCM'` - AES-GCM with 128/192-bit keys

### Expiration Time Format
- `'10m'` - 10 minutes
- `'1h'` - 1 hour
- `'7d'` - 7 days
- `'30s'` - 30 seconds

### JWT Claims
- `issuer` (iss) - Token issuer identification
- `audience` (aud) - Intended token recipient
- `subject` (sub) - Token subject (usually user ID)

## Related Documentation

- [SessionManager](./session-manager.md) - For SSO-based session management
- [HTTP Handlers](./http-handlers.md) - For error handling in authentication flows
- [Back to main documentation](../README.md)