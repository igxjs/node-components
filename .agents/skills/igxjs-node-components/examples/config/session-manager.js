import {
  SessionManager,
  SessionMode,
} from '@igxjs/node-components';

export const session = new SessionManager({
  SSO_ENDPOINT_URL: process.env.SSO_ENDPOINT_URL,
  SSO_APP_ID:       process.env.SSO_APP_ID,
  SSO_JWT_SECRET:   process.env.SSO_JWT_SECRET,
  SSO_SUCCESS_URL:  '/dashboard',
  SSO_FAILURE_URL:  '/login',
  SESSION_MODE:     SessionMode.TOKEN,
  SESSION_SECRET:   process.env.SESSION_SECRET,
  REDIS_URL:        process.env.REDIS_URL,
});
