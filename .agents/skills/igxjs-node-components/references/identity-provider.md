# Identity Provider Microservice Contract

`SSO_ENDPOINT_URL` points at a separate IdP microservice that `SessionManager` calls internally. The consumer doesn't write any of these endpoints — but knowing the contract helps when:
- Debugging SSO failures (which endpoint did `SessionManager` call?)
- Standing up a new IdP that must speak this contract
- Mocking the IdP in tests

## IdP endpoints SessionManager calls directly

| Method | Path | Used by SessionManager method | Purpose |
|--------|------|-------------------------------|---------|
| GET | `/auth/providers?app_id={appId}` | `identityProviders()` | List available IdPs (id, name, icon, login URL) |
| POST | `/auth/refresh?app_id={appId}` | `refresh()` | Renew access/refresh tokens |

The base URL must include the API version prefix, e.g., `https://idp.example.com/open/api/v1`.
For `identityProviders()` and `refresh()`, `SessionManager` reads a string `req.query.app_id` and falls back to `SSO_APP_ID` when it is empty or missing.

Login is initiated from the provider list, not from a custom `SessionManager.login()` wrapper. The consumer calls its own `/auth/providers?app_id=...`, receives provider objects, and redirects the browser/client to the selected provider's `url`. Do not generate Express middleware that calls Axios `POST /auth/login/:idp`; that endpoint is an IdP implementation detail surfaced through the provider `url`.

The IdP service may expose other endpoints such as `/auth/login/:idp`, `/auth/callback/:idp`, or `/auth/verify` internally. They are part of the IdP implementation, not methods the consumer app should recreate when integrating `SessionManager`.

## /auth/providers response shape

```json
[
  {
    "id": "google",
    "priority": 1,
    "name": "Google",
    "url": "https://idp.example.com/open/api/v1/auth/login/google",
    "attributes": {
      "icon": "https://cdn.example.com/google.svg",
      "kind": "primary"
    }
  }
]
```

The `url` field is the login address to use for that provider and `app_id` context. A server-rendered app can redirect to it; an SPA can navigate to it after fetching providers.

## Callback payload consumed by `SessionManager.callback()`

After the provider login completes, the IdP redirects back to the consumer app's callback route with `?jwt=...`. `SessionManager.callback()` decrypts that JWT locally with `SSO_JWT_SECRET`; it does not call an IdP callback endpoint. The JWT payload contains `SessionUser` data:

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
    expires_at: number;     // ms epoch — local timeout
    expires_rt: number;     // ms epoch — remote (refresh-token) timeout
    access_token: string;
    refresh_token: string;
    groups: string[];
  };
}
```

`SessionManager.callback()` runs the `initUser` transform, then either persists to session (SESSION mode) or generates a new internal JWT and stores in Redis (TOKEN mode).

## Authorization

`SSO_APP_ID` selects the IdP application registration through the `app_id` query parameter used by `identityProviders()` and `refresh()`. `SSO_JWT_SECRET` is used locally by `SessionManager` to decrypt/verify JWT payloads returned by the IdP. The library's Axios instance is configured with `baseURL: SSO_ENDPOINT_URL` and a timeout; do not claim it automatically adds custom app-secret headers.
