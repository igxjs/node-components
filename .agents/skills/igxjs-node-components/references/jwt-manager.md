# JwtManager Reference

JWE-based encrypted JWT manager built on `jose`. Use it directly only when you need encrypted tokens **outside** the SSO flow (e.g., password reset links, signed download URLs, internal service-to-service tokens). For SSO/auth, use `SessionManager` instead — it uses `JwtManager` internally.

## Naming convention (strict)

| Where | Convention | Example |
|-------|-----------|---------|
| Constructor | UPPERCASE with `JWT_` prefix | `JWT_EXPIRATION_TIME` |
| `encrypt(data, input, options)` | camelCase | `expirationTime` |
| `decrypt(token, input, options)` | camelCase | `clockTolerance` |

Mixing them causes silent fallbacks to defaults.

## Constructor options (all optional)

| Key | Default | Notes |
|-----|---------|-------|
| `JWT_ALGORITHM` | `'dir'` | JWE alg. `'dir'` = direct symmetric. Other: `'A128KW'`, `'A192KW'`, `'A256KW'`, `'RSA-OAEP'`. |
| `JWT_ENCRYPTION` | `'A256GCM'` | Content encryption. Alts: `'A128GCM'`, `'A192GCM'`. |
| `JWT_EXPIRATION_TIME` | `64800` (18h) | Number = seconds, or string with suffix (`'1h'`, `'7d'`, `'30s'`, `'1080m'`). |
| `JWT_CLOCK_TOLERANCE` | `30` | Seconds of allowed clock drift. |
| `JWT_SECRET_HASH_ALGORITHM` | `'SHA-256'` | Used to derive key from `input` string. |
| `JWT_ISSUER` / `JWT_AUDIENCE` / `JWT_SUBJECT` | undefined | Standard JWT claims. |

## encrypt(data, input, options?)

```javascript
const jwt = new JwtManager({ JWT_ISSUER: 'myapp', JWT_AUDIENCE: 'api' });
const token = await jwt.encrypt({ userId: 'u1' }, secret);
```

`input` is a **secret string**, hashed via `secretHashAlgorithm` to produce the encryption key. It must be the same value used at decrypt time.

Per-call camelCase overrides: `algorithm`, `encryption`, `expirationTime`, `secretHashAlgorithm`, `issuer`, `audience`, `subject`.

```javascript
// Short-lived password-reset token
const reset = await jwt.encrypt(
  { email },
  secret,
  { expirationTime: '15m', subject: 'password-reset' }
);
```

## decrypt(token, input, options?)

Returns `{ payload, protectedHeader }`. Throws on:
- Invalid format / wrong key
- Expired (`ERR_JWT_EXPIRED`)
- Issuer / audience / subject mismatch when those options are provided
- Clock drift beyond `clockTolerance`

```javascript
const { payload } = await jwt.decrypt(token, secret, {
  issuer: 'myapp',
  audience: 'api',
});
```

Per-call camelCase overrides: `clockTolerance`, `secretHashAlgorithm`, `issuer`, `audience`, `subject`.

## Common gotchas

- **Hash algorithm mismatch**: encrypting with default SHA-256 and decrypting with `secretHashAlgorithm: 'SHA-512'` fails. Both sides must agree.
- **Don't reuse SSO secrets**: `JwtManager` for non-SSO flows should use a separate secret from `SSO_JWT_SECRET` / `SESSION_SECRET` to limit blast radius if one leaks.
- **Numbers vs strings for `expirationTime`**: numbers are seconds (passed through after conversion); strings go directly to `jose` and use its parser. Stick to one style per project for consistency.
- **JWE, not JWS**: tokens are encrypted, so the payload is opaque on the wire. Don't try to decode them client-side without the secret.

## Refresh token pattern

```javascript
const access  = new JwtManager({ JWT_EXPIRATION_TIME: '15m', JWT_SUBJECT: 'access' });
const refresh = new JwtManager({ JWT_EXPIRATION_TIME: '7d',  JWT_SUBJECT: 'refresh' });

async function issueTokenPair(user) {
  return {
    accessToken:  await access.encrypt({ sub: user.id }, ACCESS_SECRET),
    refreshToken: await refresh.encrypt({ sub: user.id }, REFRESH_SECRET),
  };
}
```

Use distinct secrets for access vs refresh so a stolen access token can't be used to mint a refresh token.
