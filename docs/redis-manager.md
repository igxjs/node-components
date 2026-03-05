# RedisManager

Redis connection management with TLS support and automatic reconnection handling.

## Overview

RedisManager provides a robust Redis client with:
- TLS/SSL support for secure connections
- Automatic reconnection handling
- Connection status monitoring
- Clean disconnection management

**Note:** RedisManager is used internally by the [SessionManager](./session-manager.md), so you typically don't need to use it directly unless you need custom Redis operations.

## Usage Example

```javascript
import { RedisManager } from '@igxjs/node-components';

const redisManager = new RedisManager();

// Connect to Redis (with optional TLS certificate)
const connected = await redisManager.connect(
  'rediss://localhost:6379',
  '/path/to/cert.pem'
);

if (connected) {
  // Get Redis client for direct operations
  const client = redisManager.getClient();
  await client.set('key', 'value');
  const value = await client.get('key');
  console.log(value); // 'value'
  
  // Check connection status
  const isConnected = await redisManager.isConnected();
  console.log('Connected:', isConnected);
  
  // Disconnect when done
  await redisManager.disConnect();
}
```

## Connection URLs

RedisManager supports two URL formats:

### Standard Redis (non-TLS)
```javascript
await redisManager.connect('redis://localhost:6379');
await redisManager.connect('redis://username:password@host:6379');
```

### Secure Redis (TLS)
```javascript
// Requires certificate path for TLS
await redisManager.connect(
  'rediss://localhost:6379',
  '/path/to/certificate.pem'
);
```

## Advanced Usage

### Custom Operations

```javascript
import { RedisManager } from '@igxjs/node-components';

const redisManager = new RedisManager();
await redisManager.connect(process.env.REDIS_URL);

const client = redisManager.getClient();

// String operations
await client.set('user:1', JSON.stringify({ name: 'John' }));
const user = JSON.parse(await client.get('user:1'));

// Hash operations
await client.hSet('user:2', 'name', 'Jane');
await client.hSet('user:2', 'email', 'jane@example.com');
const userData = await client.hGetAll('user:2');

// List operations
await client.lPush('tasks', 'task1');
await client.lPush('tasks', 'task2');
const tasks = await client.lRange('tasks', 0, -1);

// Set operations
await client.sAdd('tags', 'javascript');
await client.sAdd('tags', 'nodejs');
const tags = await client.sMembers('tags');

// Expiration
await client.setEx('temporary', 3600, 'expires in 1 hour');
await client.expire('user:1', 3600);

// Clean up
await redisManager.disConnect();
```

### Connection Monitoring

```javascript
const redisManager = new RedisManager();

// Check if connected before operations
if (await redisManager.isConnected()) {
  const client = redisManager.getClient();
  // Perform operations
} else {
  console.log('Redis not connected');
}
```

### Error Handling

```javascript
const redisManager = new RedisManager();

try {
  const connected = await redisManager.connect(process.env.REDIS_URL);
  
  if (!connected) {
    console.error('Failed to connect to Redis');
    // Fall back to memory storage or handle appropriately
    return;
  }
  
  const client = redisManager.getClient();
  await client.set('key', 'value');
  
} catch (error) {
  console.error('Redis operation failed:', error);
} finally {
  await redisManager.disConnect();
}
```

## API Methods

### `connect(redisUrl, certPath?)`

Connect to Redis server.

**Parameters:**
- `redisUrl` (string) - Redis connection URL (`redis://` or `rediss://`)
- `certPath` (string, optional) - Path to TLS certificate file (required for `rediss://`)

**Returns:** `Promise<boolean>` - Returns `true` if connected successfully

**Example:**
```javascript
// Non-TLS connection
await redisManager.connect('redis://localhost:6379');

// TLS connection
await redisManager.connect('rediss://localhost:6379', '/path/to/cert.pem');
```

### `getClient()`

Get the Redis client instance for direct operations.

**Returns:** Redis client object

**Example:**
```javascript
const client = redisManager.getClient();
await client.set('key', 'value');
await client.get('key');
```

### `isConnected()`

Check if Redis connection is active and responsive.

**Returns:** `Promise<boolean>` - Returns `true` if connected and responsive

**Example:**
```javascript
const connected = await redisManager.isConnected();
if (connected) {
  // Proceed with operations
}
```

### `disConnect()`

Disconnect from Redis server and clean up resources.

**Returns:** `Promise<void>`

**Example:**
```javascript
await redisManager.disConnect();
```

## Features

- **Automatic Reconnection**: Handles connection drops and reconnects automatically
- **TLS Support**: Secure connections with certificate-based authentication
- **Connection Pooling**: Efficient connection management
- **Error Handling**: Graceful error handling and logging
- **Health Checks**: Built-in connection status monitoring

## Related Documentation

- [SessionManager](./session-manager.md) - Uses RedisManager for session storage
- [Back to main documentation](../README.md)