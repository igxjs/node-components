# Identity Provider Microservice Contract

`SSO_ENDPOINT_URL` points at a separate IdP microservice that `SessionManager` calls internally. The consumer doesn't write any of these endpoints — but knowing the contract helps when:
- Debugging SSO failures (which endpoint did `SessionManager` call?)
- Standing up a new IdP that must speak this contract
- Mocking the IdP in tests

## Endpoints SessionManager calls

| Method | Path | Used by SessionManager method | Purpose |
|--------|------|-------------------------------|---------|
| GET | `/auth/providers` | `identityProviders()` | List available IdPs (id, name, icon, login URL) |
| POST | `/auth/login/:idp` | (client-initiated, returns redirect URL) | Build login URL for selected IdP |
| GET | `/auth/callback/:idp` | `callback()` | Validate IdP redirect, return user JWT |
| POST | `/auth/verify` | (internal) | Verify a JWT issued by the IdP |
| POST | `/auth/refresh` | `refresh()` | Renew access/refresh tokens |

The base URL must include the API version prefix, e.g., `https://idp.example.com/open/api/v1`.

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

## /auth/callback/:idp response

Returns a JWT containing `SessionUser` data:

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

`SessionManager.callback()` decrypts that JWT with `SSO_JWT_SECRET`, runs the `initUser` transform, then either persists to session (SESSION mode) or generates a new internal JWT and stores in Redis (TOKEN mode).

## Authorization

The library uses `SSO_APP_ID` + `SSO_JWT_SECRET` to authenticate to the IdP microservice. The exact mechanism (header, query param) is determined by the IdP — `SessionManager` configures an Axios instance and the IdP must accept whatever it sends.
