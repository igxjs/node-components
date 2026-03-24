import 'express-session';

import { AxiosError } from 'axios';
import { EncryptJWT, JWTDecryptResult, JWTPayload } from 'jose';
import { RedisClientType } from '@redis/client';
import { Application, RequestHandler, Request, Response, NextFunction, Router } from 'express';

export { JWTPayload } from 'jose';

// Logger class for configurable logging
export class Logger {
  /**
   * Get or create a Logger instance (singleton pattern)
   * @param componentName Component name for log prefix
   * @param enableLogging Enable/disable logging (defaults to NODE_ENV !== 'production')
   * @returns Logger instance
   */
  static getInstance(componentName: string, enableLogging?: boolean): Logger;

  /**
   * Clear all logger instances (useful for testing)
   */
  static clearInstances(): void;

  /**
   * Disable colors globally for all logger instances
   */
  static disableColors(): void;

  /**
   * Enable colors globally for all logger instances
   */
  static enableColors(): void;

  /**
   * Create a new Logger instance (backward compatibility)
   * Note: Use Logger.getInstance() for singleton pattern
   * @param componentName Component name for log prefix
   * @param enableLogging Enable/disable logging (defaults to NODE_ENV !== 'production')
   */
  constructor(componentName: string, enableLogging?: boolean);

  /**
   * Log debug message
   * @param args Arguments to log
   */
  debug(...args: any[]): void;

  /**
   * Log info message
   * @param args Arguments to log
   */
  info(...args: any[]): void;

  /**
   * Log warning message
   * @param args Arguments to log
   */
  warn(...args: any[]): void;

  /**
   * Log error message
   * @param args Arguments to log
   */
  error(...args: any[]): void;

  /**
   * Log general message
   * @param args Arguments to log
   */
  log(...args: any[]): void;
}

// Session Mode constants
export const SessionMode: {
  SESSION: string;
  TOKEN: string;
};

// Session Configuration - uses strict UPPERCASE naming convention for all property names
export interface SessionConfig {
  /** 
   * SSO Identity Provider endpoint URL
   * @example 'https://idp.example.com/open/api/v1'
   * @required Required when using SSO authentication
   */
  SSO_ENDPOINT_URL?: string;

  /** 
   * OAuth2 Client ID registered with the Identity Provider
   * @example 'my-app-client-id'
   * @required Required when using SSO authentication
   */
  SSO_CLIENT_ID?: string;

  /** 
   * OAuth2 Client Secret for authentication
   * @example 'super-secret-client-key'
   * @required Required when using SSO authentication
   */
  SSO_CLIENT_SECRET?: string;

  /** 
   * Redirect URL after successful SSO login
   * @example '/dashboard' or 'https://myapp.com/home'
   * @default '/'
   */
  SSO_SUCCESS_URL?: string;

  /** 
   * Redirect URL after failed SSO login
   * @example '/login?error=auth_failed'
   * @default '/login'
   */
  SSO_FAILURE_URL?: string;

  /** 
   * Authentication mode: 'session' for cookie-based sessions, 'token' for JWT token-based auth
   * @example 'session' | 'token'
   * @default 'session'
   */
  SESSION_MODE?: string;

  /** 
   * Session expiration time in seconds
   * @example 3600 (1 hour) or 86400 (24 hours) or 64800 (18 hours)
   * @default 64800 (18 hours)
   */
  SESSION_AGE?: number;

  /** 
   * Cookie path for session cookies
   * @example '/' for entire site or '/app' for specific path
   * @default '/'
   */
  SESSION_COOKIE_PATH?: string;

  /** 
   * Secret key used for signing session cookies (should be a strong random string)
   * @example 'your-super-secret-session-key-change-this-in-production'
   * @required Required for session-based authentication
   */
  SESSION_SECRET?: string;

  /**
   * Redis key prefix for storing session data
   * @example 'myapp:session:' (will result in keys like 'myapp:session:user@example.com')
   * @default 'ibmid:' (legacy default, consider changing for your use case)
   */
  SESSION_PREFIX?: string;

  /**
   * Redis key name for storing session data
   * - In SESSION mode: key used to store the user in the session
   * - In TOKEN mode: key of localStorage where the token is stored
   * @example 'user' (results in session.user containing user data)
   * @default 'session_token'
   */
  SESSION_KEY?: string;

  /**
   * Redis key name for storing session expiry timestamp
   * - In TOKEN mode: key of localStorage where the session expiry timestamp is stored
   * @example 'expires' (results in session.expires containing expiry time)
   * @default 'session_expires_at'
   */
  SESSION_EXPIRY_KEY?: string;

  /** 
   * Path to custom HTML template for token storage page (TOKEN mode only)
   * @example './templates/token-storage.html'
   * @default Built-in template included in the library
   */
  TOKEN_STORAGE_TEMPLATE_PATH?: string;

  /** 
   * Redis connection URL
   * @example 'redis://localhost:6379' or 'rediss://user:pass@host:6380/0' (rediss for TLS)
   * @required Required when using Redis for session storage
   */
  REDIS_URL?: string;

  /** 
   * Path to TLS certificate file for secure Redis connections
   * @example '/path/to/redis-ca-cert.pem'
   * @optional Only needed for TLS-enabled Redis connections
   */
  REDIS_CERT_PATH?: string;

  /** 
   * JWE algorithm for token encryption
   * @example 'dir' (Direct Key Agreement) or 'RSA-OAEP' or 'A256KW'
   * @default 'dir'
   * @see https://tools.ietf.org/html/rfc7518#section-4.1
   */
  JWT_ALGORITHM?: string;

  /** 
   * JWE encryption method
   * @example 'A256GCM' (AES-256 GCM) or 'A128GCM' or 'A192GCM'
   * @default 'A256GCM'
   * @see https://tools.ietf.org/html/rfc7518#section-5.1
   */
  JWT_ENCRYPTION?: string;

  /** 
   * Clock tolerance in seconds for JWT token validation (allows for time drift between servers)
   * @example 30 (allows 30 seconds of clock skew)
   * @default 30
   */
  JWT_CLOCK_TOLERANCE?: number;

  /** 
   * Hash algorithm for deriving encryption key from secret
   * @example 'SHA-256' or 'SHA-384' or 'SHA-512'
   * @default 'SHA-256'
   */
  JWT_SECRET_HASH_ALGORITHM?: string;

  /** 
   * JWT issuer claim (iss) - identifies the principal that issued the token
   * @example 'https://myapp.com' or 'my-auth-service'
   * @optional Adds additional security validation
   */
  JWT_ISSUER?: string;

  /** 
   * JWT audience claim (aud) - identifies the recipients that the token is intended for
   * @example 'https://api.myapp.com' or 'my-api-service'
   * @optional Adds additional security validation
   */
  JWT_AUDIENCE?: string;

  /** 
   * JWT subject claim (sub) - identifies the principal that is the subject of the token
   * @example 'user-authentication' or 'api-access'
   * @optional Adds additional context to tokens
   */
  JWT_SUBJECT?: string;
}

export interface SessionUserAttributes {
  /** @type {string} Identity Provider ID */
  idp: string;
  /** @type {string} User ID */
  sub: string;
  /** @type {number} Local timeout timestamp */
  expires_at: number;
  /** @type {number} Remote timeout timestamp */
  expires_rt: number;
  /** @type {string} Access token */
  access_token: string;
  /** @type {string} Refresh token */
  refresh_token: string;
  /** @type {Array<string>} Groups of the user */
  groups: string[];
}

export interface SessionUser {
  /** @type {string} First name */
  first_name: string;
  /** @type {string} Last name */
  last_name: string;
  /** @type {string} Full name */
  name: string;
  /** @type {string} Email address */
  email: string;
  /** @type {SessionUserAttributes} User attributes */
  attributes: SessionUserAttributes;
  /** @type {boolean} User is authorized */
  authorized: boolean;
}

// Session Manager
export class SessionManager {
  /**
   * Create a new SessionManager instance
   * @param config Session configuration object with UPPERCASE property names
   * @example
   * ```javascript
   * const sessionManager = new SessionManager({
   *   SSO_ENDPOINT_URL: 'https://idp.example.com/open/api/v1',
   *   SSO_CLIENT_ID: 'my-app-client-id',
   *   SSO_CLIENT_SECRET: 'secret-key',
   *   SESSION_MODE: 'session', // or 'token' for JWT-based auth
   *   SESSION_SECRET: 'your-session-secret',
   *   REDIS_URL: 'redis://localhost:6379'
   * });
   * ```
   */
  constructor(config: SessionConfig);

  /**
   * Check if the email has a session refresh lock
   * @param email Email address
   * @returns Returns true if the email has a session refresh lock
   */
  hasLock(email: string): boolean;

  /**
   * Lock the email for session refresh
   * @param email Email address
   */
  lock(email: string): void;

  /**
   * Clear session refresh locks
   */
  clearLocks(): NodeJS.Timeout;

  /**
   * Get the Redis Manager
   */
  redisManager(): RedisManager;

  /**
   * Get authenticated user data (works for both SESSION and TOKEN modes)
   * @param req Express request object
   * @param includeUserData Include user data in the response (default: false)
   * @returns Promise resolving to full user data object
   * @throws CustomError If user is not authenticated
   * @example
   * ```javascript
   * // Use in custom middleware
   * app.use(async (req, res, next) => {
   *   try {
   *     const user = await sessionManager.getUser(req, true);
   *     req.customUser = user;
   *     next();
   *   } catch (error) {
   *     next(error);
   *   }
   * });
   * ```
   */
  getUser(req: Request, includeUserData: boolean?): Promise<SessionUser>;

  /**
   * Initialize the session configurations and middleware
   * @param app Express application
   */
  setup(app: Application): Promise<void>;

  /**
   * Middleware to load full user data into req.user
   * - SESSION mode: Loads user from session store (req.session[SESSION_KEY])
   * - TOKEN mode: Loads user from Redis using JWT token
   * - Provides request-level caching to avoid redundant lookups
   * - Should be used after authenticate() middleware
   * @returns Returns express Request Handler
   * @example
   * ```javascript
   * app.get('/api/profile',
   *   session.authenticate(),    // Verifies authentication
   *   session.requireUser(),      // Loads user data into req.user
   *   (req, res) => {
   *     res.json({ user: req.user }); // User data available here
   *   }
   * );
   * ```
   */
  requireUser(): RequestHandler;

  /**
   * Resource protection middleware based on configured SESSION_MODE
   * - SESSION mode: Verifies user exists in session store and is authorized (checks req.session data)
   * - TOKEN mode: Validates JWT token from Authorization header (lightweight validation)
   * 
   * Note: This method verifies authentication only and does NOT populate req.user.
   * Use requireUser() after this middleware to load user data into req.user.
   * 
   * @param errorRedirectUrl Redirect URL on authentication failure (default: '')
   * @returns Returns express Request Handler
   * @example
   * ```javascript
   * // Option 1: Just verify authentication (user data remains in req.session or token)
   * app.get('/api/check', 
   *   session.authenticate(), 
   *   (req, res) => {
   *     res.json({ authenticated: true });
   *   }
   * );
   * 
   * // Option 2: Verify authentication AND populate req.user (recommended for most use cases)
   * app.get('/api/profile',
   *   session.authenticate(),    // Verifies session/token validity
   *   session.requireUser(),      // Loads user data into req.user
   *   (req, res) => {
   *     res.json({ user: req.user }); // User data now available
   *   }
   * );
   * ```
   */
  authenticate(errorRedirectUrl?: string): RequestHandler;

  /**
   * Resource protection by token (explicit token verification)
   * Requires Authorization: Bearer {token} header
   * @param errorRedirectUrl Redirect URL (default: '')
   * @returns Returns express Request Handler
   */
  verifyToken(errorRedirectUrl?: string): RequestHandler;

  /**
   * Resource protection by session (explicit session verification)
   * @param errorRedirectUrl Redirect URL (default: '')
   * @returns Returns express Request Handler
   */
  verifySession(errorRedirectUrl?: string): RequestHandler;

  /**
   * SSO callback for successful login
   * SESSION mode: Saves session and redirects
   * TOKEN mode: Generates JWT token, returns HTML page with localStorage script
   * @param initUser Initialize user object function
   * @returns Returns express Request Handler
   */
  callback(initUser: (user: SessionUser) => SessionUser): RequestHandler;

  /**
   * Get Identity Providers
   * @returns Returns express Request Handler
   */
  identityProviders(): RequestHandler;

  /**
   * Refresh user authentication based on configured SESSION_MODE
   * SESSION mode: Refreshes session data
   * TOKEN mode: Generates new token, invalidates old token
   * @param initUser Initialize user object function
   * @returns Returns express Request Handler
   */
  refresh(initUser: (user: SessionUser) => SessionUser): RequestHandler;

  /**
   * Application logout based on configured SESSION_MODE (NOT SSO)
   * SESSION mode: Destroys session and clears cookie
   * TOKEN mode: Invalidates current token or all tokens (with ?all=true query param)
   * Query params: redirect=true (redirect to success/failure URL), all=true (logout all tokens - TOKEN mode only)
   * @returns Returns express Request Handler
   */
  logout(): RequestHandler;
}

// Custom Error class
export class CustomError extends Error {
  code: number;
  data: object;
  error: object;

  /**
   * Construct a custom error
   * @param code Error code
   * @param message Message
   * @param error Error object (optional)
   * @param data Additional data (optional)
   */
  constructor(code: number, message: string, error?: object, data?: object);
}

// FlexRouter class for Express routing
export class FlexRouter {
  context: string;
  router: Router;
  handlers: RequestHandler[];

  /**
   * Constructor
   * @param context Context path
   * @param router Router instance
   * @param handlers Request handlers (optional)
   */
  constructor(context: string, router: Router, handlers?: RequestHandler[]);

  /**
   * Mount router to Express app
   * @param app Express application
   * @param basePath Base path
   */
  mount(app: Application, basePath: string): void;
}

// RedisManager class for Redis connection management
export class RedisManager {
  /**
   * Connect with Redis
   * @param redisUrl Redis connection URL
   * @param certPath Certificate path for TLS connections
   * @returns Returns true if Redis server is connected
   */
  connect(redisUrl: string, certPath: string): Promise<boolean>;

  /**
   * Get Redis client
   * @returns Returns Redis client instance
   */
  getClient(): RedisClientType;

  /**
   * Determine if the Redis server is connected
   * @returns Returns true if the Redis server is connected
   */
  isConnected(): Promise<boolean>;

  /**
   * Disconnect from Redis
   * @returns Returns nothing
   */
  disconnect(): Promise<void>;
}

// JWT Manager Configuration - uses strict UPPERCASE naming convention with JWT_ prefix for all property names
export interface JwtManagerOptions {
  /** 
   * JWE algorithm for token encryption
   * @example 'dir' (Direct Key Agreement - symmetric encryption, recommended for most cases)
   * @example 'RSA-OAEP' (RSA with OAEP padding - for asymmetric encryption)
   * @example 'A256KW' (AES Key Wrap with 256-bit key)
   * @default 'dir'
   * @see https://tools.ietf.org/html/rfc7518#section-4.1
   */
  JWT_ALGORITHM?: string;

  /** 
   * JWE content encryption method
   * @example 'A256GCM' (AES-256 GCM - recommended, highest security)
   * @example 'A128GCM' (AES-128 GCM - faster, lower security)
   * @example 'A192GCM' (AES-192 GCM - balanced)
   * @default 'A256GCM'
   * @see https://tools.ietf.org/html/rfc7518#section-5.1
   */
  JWT_ENCRYPTION?: string;

  /** 
   * Token expiration time - accepts number (seconds) or string with time suffix
   * @example 64800 (18 hours as number)
   * @example '18h' (18 hours)
   * @example '7d' (7 days)
   * @example '1080m' (1080 minutes = 18 hours)
   * @example '30s' (30 seconds)
   * @default 64800 (18 hours)
   */
  JWT_EXPIRATION_TIME?: number | string;

  /** 
   * Clock tolerance in seconds for token validation
   * Allows for small time differences between client and server clocks
   * @example 30 (allows 30 seconds of clock drift)
   * @example 60 (more lenient, allows 1 minute of drift)
   * @default 30
   */
  JWT_CLOCK_TOLERANCE?: number;

  /** 
   * Hash algorithm used for deriving encryption key from secret string
   * @example 'SHA-256' (recommended for most cases)
   * @example 'SHA-384' (higher security)
   * @example 'SHA-512' (highest security, slower)
   * @default 'SHA-256'
   */
  JWT_SECRET_HASH_ALGORITHM?: string;

  /** 
   * JWT issuer claim (iss) - identifies who issued the token
   * Used for token validation to ensure tokens are from expected source
   * @example 'https://myapp.com'
   * @example 'my-auth-service'
   * @optional Recommended for production environments
   */
  JWT_ISSUER?: string;

  /** 
   * JWT audience claim (aud) - identifies the intended recipients
   * Used for token validation to ensure tokens are for the correct service
   * @example 'https://api.myapp.com'
   * @example ['api.myapp.com', 'admin.myapp.com'] (can be array)
   * @optional Recommended for production environments
   */
  JWT_AUDIENCE?: string;

  /** 
   * JWT subject claim (sub) - identifies the principal (subject) of the token
   * Provides context about what the token represents
   * @example 'user-authentication'
   * @example 'api-access-token'
   * @optional Adds semantic meaning to tokens
   */
  JWT_SUBJECT?: string;
}

/**
 * Options for encrypt() method - uses camelCase naming convention
 * These options allow you to override the defaults set in JwtManagerOptions for specific encryption operations
 */
export interface JwtEncryptOptions {
  /** 
   * Override default JWE algorithm for this specific token
   * @example 'dir' or 'RSA-OAEP'
   * @use-case Use when you need different encryption algorithms for different token types
   */
  algorithm?: string;

  /** 
   * Override default encryption method for this specific token
   * @example 'A256GCM' or 'A128GCM'
   * @use-case Use when you need different encryption strength for different token types
   */
  encryption?: string;

  /** 
   * Override default expiration time for this specific token
   * @example '1h' (short-lived token for sensitive operations)
   * @example '30m' (half hour)
   * @example '7d' (long-lived token for remember-me functionality)
   * @example 3600 (1 hour as number in seconds)
   * @use-case Use when different tokens need different lifetimes (e.g., access token vs refresh token)
   */
  expirationTime?: number | string;

  /** 
   * Override default hash algorithm for deriving encryption key
   * @example 'SHA-256' or 'SHA-512'
   * @use-case Use when you need stronger hashing for specific high-security tokens
   */
  secretHashAlgorithm?: string;

  /** 
   * Override default issuer claim for this specific token
   * @example 'https://admin.myapp.com' (for admin tokens)
   * @use-case Use when tokens are issued by different services
   */
  issuer?: string;

  /** 
   * Override default audience claim for this specific token
   * @example 'https://api.myapp.com' (for API access tokens)
   * @example ['service1.myapp.com', 'service2.myapp.com'] (multiple audiences)
   * @use-case Use when tokens are intended for different services
   */
  audience?: string;

  /** 
   * Override default subject claim for this specific token
   * @example 'password-reset' (for password reset tokens)
   * @example 'email-verification' (for verification tokens)
   * @use-case Use when different token types serve different purposes
   */
  subject?: string;
}

/**
 * Options for decrypt() method - uses camelCase naming convention
 * These options allow you to override validation settings and verify specific claims during decryption
 */
export interface JwtDecryptOptions {
  /** 
   * Override default clock tolerance for this specific token validation
   * @example 30 (seconds) - allows 30 seconds of clock drift
   * @example 60 (seconds) - more lenient for distributed systems
   * @use-case Use when validating tokens from systems with known clock drift issues
   */
  clockTolerance?: number;

  /** 
   * Override default hash algorithm for deriving decryption key
   * Must match the algorithm used during encryption
   * @example 'SHA-256' or 'SHA-512'
   * @use-case Use when tokens were encrypted with different hash algorithms
   */
  secretHashAlgorithm?: string;

  /** 
   * Expected issuer claim (iss) for validation
   * Token will be rejected if issuer doesn't match
   * @example 'https://myapp.com'
   * @use-case Use to ensure tokens come from a specific trusted source
   */
  issuer?: string;

  /** 
   * Expected audience claim (aud) for validation
   * Token will be rejected if audience doesn't match
   * @example 'https://api.myapp.com'
   * @example ['service1.myapp.com', 'service2.myapp.com'] (multiple valid audiences)
   * @use-case Use to ensure tokens are intended for your service
   */
  audience?: string;

  /** 
   * Expected subject claim (sub) for validation
   * Token will be rejected if subject doesn't match
   * @example 'user-authentication'
   * @use-case Use to validate tokens are of the expected type/purpose
   */
  subject?: string;
}

export type JwtDecryptResult = JWTDecryptResult;

// JwtManager class for JWT encryption and decryption
export class JwtManager {
  algorithm: string;
  encryption: string;
  expirationTime: number;
  clockTolerance: number;
  secretHashAlgorithm: string;
  issuer?: string;
  audience?: string;
  subject?: string;

  /**
   * Create a new JwtManager instance with configurable defaults
   * @param options Configuration options (uses strict UPPERCASE with JWT_ prefix property names)
   * @example
   * ```javascript
   * const jwtManager = new JwtManager({
   *   JWT_ALGORITHM: 'dir',
   *   JWT_ENCRYPTION: 'A256GCM',
   *   JWT_EXPIRATION_TIME: '18h', // or 64800 seconds
   *   JWT_ISSUER: 'https://myapp.com',
   *   JWT_AUDIENCE: 'https://api.myapp.com'
   * });
   * ```
   */
  constructor(options?: JwtManagerOptions);

  /**
   * Generate JWT token for user session
   * @param data User data payload
   * @param input Secret key or password for encryption
   * @param options Per-call configuration overrides (uses camelCase property names)
   * @returns Returns encrypted JWT token
   */
  encrypt(data: JWTPayload, input: string, options?: JwtEncryptOptions): Promise<string>;

  /**
   * Decrypt and validate JWT token for user session
   * @param token JWT token string to decrypt and validate
   * @param input Secret key or password for decryption (must match the key used for encryption)
   * @param options Per-call validation overrides (uses camelCase property names)
   * @returns Returns decrypted JWT token result containing payload and protected header
   * @throws Will throw error if token is invalid, expired, or validation fails
   * @example
   * ```javascript
   * try {
   *   const result = await jwtManager.decrypt(
   *     tokenString,
   *     'my-secret-key',
   *     { issuer: 'https://myapp.com' } // Optional: validate issuer claim
   *   );
   *   console.log(result.payload); // Access decrypted data
   * } catch (error) {
   *   console.error('Token validation failed:', error.message);
   * }
   * ```
   */
  decrypt(token: string, input: string, options?: JwtDecryptOptions): Promise<JwtDecryptResult>;
}

// HTTP status code keys (exposed for type safety)
export const httpCodes: {
  OK: number;
  CREATED: number;
  NO_CONTENT: number;
  BAD_REQUEST: number;
  UNAUTHORIZED: number;
  FORBIDDEN: number;
  NOT_FOUND: number;
  NOT_ACCEPTABLE: number;
  CONFLICT: number;
  LOCKED: number;
  SYSTEM_FAILURE: number;
  NOT_IMPLEMENTED: number;
};

// HTTP message keys (exposed for type safety)
export const httpMessages: {
  OK: string;
  CREATED: string;
  NO_CONTENT: string;
  BAD_REQUEST: string;
  UNAUTHORIZED: string;
  FORBIDDEN: string;
  NOT_FOUND: string;
  NOT_ACCEPTABLE: string;
  CONFLICT: string;
  LOCKED: string;
  SYSTEM_FAILURE: string;
  NOT_IMPLEMENTED: string;
};

/**
 * HTTP Helper utilities
 */
export const httpHelper: {
  /**
   * Format a string with placeholders
   * @param str String with {0}, {1}, etc. placeholders
   * @param args Values to replace placeholders
   * @returns Formatted string
   */
  format(str: string, ...args: any[]): string;

  /**
   * Generate friendly Zod validation error message
   * @param error Zod validation error
   * @returns Formatted error message
   */
  toZodMessage(error: any): string;

  /**
   * Analyze and convert Axios/HTTP errors to CustomError
   * @param error Error object
   * @param defaultMessage Default error message
   * @returns CustomError instance
   */
  handleAxiosError(error: Error | AxiosError, defaultMessage?: string): CustomError;
};

/**
 * HTTP Error - alias of `new CustomError()`
 * @param code Error code
 * @param message Error message
 * @param error Original Error instance
 * @param data Error data
 * @returns Returns a new instance of CustomError
 */
export function httpError(
  code: number,
  message: string,
  error?: object,
  data?: object
): CustomError;

/**
 * Custom error handler middleware
 * @param err Error object
 * @param req Express Request
 * @param res Express Response
 * @param next Next function
 */
export function httpErrorHandler(
  err: CustomError | Error | any,
  req: Request,
  res: Response,
  next: NextFunction
): void;

/**
 * HTTP not found handler middleware
 * @param req Express Request
 * @param res Express Response
 * @param next Next function
 */
export function httpNotFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void;

declare global {
  namespace Express {
    export interface Request {
      user?: SessionUser;
    }
  }
}

// Augment Express Session with custom user property
declare module 'express-session' {
  interface SessionData {
    [key: string]: any;
    user?: SessionUser;
  }
}
