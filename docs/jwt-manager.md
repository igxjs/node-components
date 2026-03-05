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

```javascript
// Example configuration object
const jwtOptions = {
  algorithm: 'dir',              // JWE algorithm (default: 'dir')
  encryption: 'A256GCM',         // JWE encryption method (default: 'A256GCM')
  expirationTime: '10m',         // Token expiration (default: '10m')
  clockTolerance: 30,            // Clock tolerance in seconds (default: 30)
  secretHashAlgorithm: 'SHA-256', // Hash algorithm for secret derivation (default: 'SHA-256')
  issuer: 'your-app',            // Optional JWT issuer claim
  audience: 'your-users',        // Optional JWT audience claim
  subject: 'user-session'        // Optional JWT subject claim
};
```

## Basic Usage

```javascript
import { JwtManager } from '@igxjs/node-components';

// Create instance with default configuration
const jwtManager = new JwtManager({
  expirationTime: '1h',
  issuer: 'my-app',
  audience: 'my-users'
});

// Encrypt user data
const userData = {
  userId: '12345',
  email: 'user@example.com',
  roles: ['admin', 'user']
};

const secret = 'your-secret-key';
const token = await jwtManager.encrypt(userData, secret);

console.log('Encrypted Token:', token);

// Decrypt token
try {
  const result = await jwtManager.decrypt(token, secret);
  console.log('Decrypted Payload:', result.payload);
  console.log('Protected Header:', result.protectedHeader);
} catch (error) {
  console.error('Token validation failed:', error);
}
```

## API Reference

### Constructor

**`new JwtManager(options?)`**

Create a new JwtManager instance. All options are optional with sensible defaults.

**Parameters:**
- `options` (JwtManagerOptions, optional) - Configuration options

### Methods

#### `encrypt(data, input, options?)`

Generate an encrypted JWT token.

**Parameters:**
- `data` (JWTPayload) - User data payload to encrypt
- `input` (string) - Secret key or password for encryption
- `options` (JwtEncryptOptions, optional) - Per-call configuration overrides

**Returns:** `Promise<string>` - Encrypted JWT token

#### `decrypt(token, input, options?)`

Decrypt and validate a JWT token.

**Parameters:**
- `token` (string) - JWT token to decrypt
- `input` (string) - Secret key or password for decryption
- `options` (JwtDecryptOptions, optional) - Per-call configuration overrides

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