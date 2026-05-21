// Using JwtManager outside of SessionManager — for password reset links,
// signed download URLs, internal service-to-service tokens, etc.
// Constructor uses UPPERCASE JWT_* keys; per-call options use camelCase.

import { JwtManager } from '@igxjs/node-components';

// Long-lived "remember me" tokens
const sessionJwt = new JwtManager({
  JWT_EXPIRATION_TIME: '30d',
  JWT_ISSUER:   'myapp',
  JWT_AUDIENCE: 'myapp-web',
});

// Short-lived password-reset tokens — separate manager so defaults differ
const resetJwt = new JwtManager({
  JWT_EXPIRATION_TIME: '15m',
  JWT_ISSUER:   'myapp',
  JWT_SUBJECT:  'password-reset',
});

const SECRET = process.env.APP_JWT_SECRET;

// --- issue ---
const sessionToken = await sessionJwt.encrypt(
  { userId: 'u_123', email: 'jane@example.com' },
  SECRET,
);

// Per-call override: temporarily shorten expiry for a sensitive operation
const stepUpToken = await sessionJwt.encrypt(
  { userId: 'u_123', stepUp: 'mfa-verified' },
  SECRET,
  { expirationTime: '5m', subject: 'step-up' },
);
console.log('step-up token length:', stepUpToken.length);

const resetToken = await resetJwt.encrypt({ email: 'jane@example.com' }, SECRET);

// --- verify ---
try {
  const { payload } = await sessionJwt.decrypt(sessionToken, SECRET, {
    issuer:   'myapp',
    audience: 'myapp-web',
  });
  console.log('userId:', payload.userId);
} catch (err) {
  // ERR_JWT_EXPIRED, signature mismatch, claim mismatch, etc.
  console.error('Token rejected:', err.message);
}

// Verify reset token with subject check to prevent token reuse across flows
const { payload: resetPayload } = await resetJwt.decrypt(resetToken, SECRET, {
  subject: 'password-reset',
});
console.log('reset email:', resetPayload.email);
