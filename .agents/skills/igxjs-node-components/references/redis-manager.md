# RedisManager Reference

Wraps `@redis/client` (Node Redis v5+) with TLS support, reconnection handling, and a tiny lifecycle API. Most consumers don't need it directly — `SessionManager` uses it internally. Reach for it when:
- The app needs Redis for application data beyond sessions
- A health check needs to probe Redis
- Tests need a connect/disconnect lifecycle hook

## API

```javascript
const rm = new RedisManager();
await rm.connect(url, certPath?);    // returns boolean
const client = rm.getClient();        // raw @redis/client RedisClientType
const live = await rm.isConnected();  // PING-based check
await rm.disconnect();
```

## URL formats

```
redis://host:6379                            // plaintext
redis://user:password@host:6379              // plaintext with auth
rediss://host:6380                           // TLS (requires certPath)
rediss://user:password@host:6380             // TLS with auth
```

`certPath` is the path to a CA certificate file in PEM format. Required for `rediss://`.

## Sharing the client with SessionManager

`SessionManager.redisManager()` returns `null` before `setup(app)` runs. After setup it returns the manager constructed internally; if `REDIS_URL` was missing or connection failed, `getClient()` can still be `null`. To reuse an established connection for application data:

```javascript
const client = session.redisManager()?.getClient();
if (client) {
  await client.set('feature:flag:beta', '1');
}
```

This avoids opening a second connection for the same Redis instance.

## Direct client usage

The returned client is a standard Node Redis v5 client; all of its commands are available:

```javascript
await client.set('key', 'value');
await client.setEx('temp', 3600, 'expires-in-1h');
await client.hSet('user:1', { name: 'Jane', email: 'jane@example.com' });
await client.hGetAll('user:1');
await client.lPush('queue', 'task');
await client.sAdd('tags', 'js', 'node');
```

Refer to `@redis/client` docs for the full command surface — `RedisManager` does not wrap or restrict commands.

## Reconnection behavior

Connection drops are handled by the underlying client; `RedisManager` ensures the client is in a usable state and logs lifecycle events via `Logger.getInstance('RedisManager')`. Long-running apps should still implement application-level retries for individual command failures.

## Cleanup

Call `disconnect()` on graceful shutdown after a successful connection to flush in-flight commands and close the socket cleanly:

```javascript
process.on('SIGTERM', async () => {
  await rm.disconnect();
  process.exit(0);
});
```
