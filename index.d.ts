import { AxiosError } from 'axios';
import { RedisClientType } from '@redis/client';
import { Application, RequestHandler, Request, Response, NextFunction, Router } from '@types/express';

declare global {
  namespace Express {
    export interface Session {
      user?: SessionUser;
    }
  }
}

// Session Configuration
export class SessionConfig {
  SSO_ENDPOINT_URL?: string;
  SSO_CLIENT_ID?: string;
  SSO_CLIENT_SECRET?: string;
  SSO_SUCCESS_URL?: string;
  SSO_FAILURE_URL?: string;

  SESSION_AGE?: number;
  SESSION_COOKIE_PATH?: string;
  SESSION_SECRET?: string;
  SESSION_PREFIX?: string;

  REDIS_URL?: string;
  REDIS_CERT_PATH?: string;
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
   * Initialize the session configurations
   * @param app Express application
   * @param config Session configurations
   * @param processUser Process user object to compute attributes like permissions, avatar URL, etc.
   */
  init(
    app: Application,
    config: SessionConfig,
    processUser: (user: SessionUser | undefined) => any
  ): Promise<void>;
  
  /**
   * Get session RequestHandler
   * @returns Returns RequestHandler instance of Express
   */
  getSession(): Promise<RequestHandler>;
  
  /**
   * Resource protection middleware
   * @param isDebugging Debugging flag (default: false)
   * @param redirectUrl Redirect URL (default: '')
   * @returns Returns express Request Handler
   */
  authenticate(isDebugging?: boolean, redirectUrl?: string): RequestHandler;
  
  /**
   * SSO callback for successful login
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
   * Application logout (NOT SSO)
   * @returns Returns express Request Handler
   */
  logout(): RequestHandler;
  
  /**
   * Refresh user session
   * @param initUser Initialize user object function
   * @returns Returns express Request Handler
   */
  refresh(initUser: (user: SessionUser) => SessionUser): RequestHandler;
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
  
  /**
   * Try to analyze axios Error
   * @param error Error object
   * @param defaultMessage Default error message
   * @returns Returns CustomError instance
   */
  static tryAxiosError(error: Error | AxiosError, defaultMessage?: string): CustomError;
  
  /**
   * Extract HTTP status code from error
   * @param error Error object
   * @returns HTTP status code
   */
  static getErrorCode(error: Error): number;
  
  /**
   * Extract error message from error
   * @param error Error object
   * @param defaultMessage Default message
   * @returns Error message
   */
  static getErrorMessage(error: Error, defaultMessage: string): string;
  
  /**
   * Get error data
   * @returns Error data
   */
  getData(): object | undefined;
  
  /**
   * Get original error
   * @returns Original error
   */
  getError(): object | undefined;
}

// Singleton session instance
export const session: SessionManager;

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
   * @returns Returns true if Redis server is connected
   */
  isConnected(): Promise<boolean>;
  
  /**
   * Disconnect from Redis
   * @returns Returns nothing
   */
  disConnect(): Promise<void>;
}

// HTTP Handlers exports
export const httpCodes: Record<string, number>;
export const httpMessages: Record<string, string>;

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