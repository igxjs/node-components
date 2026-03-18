import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import axios from 'axios';
import session from 'express-session';
import memStore from 'memorystore';
import { RedisStore } from 'connect-redis';

import { CustomError, httpCodes, httpHelper, httpMessages } from './http-handlers.js';
import { JwtManager } from './jwt.js';
import { RedisManager } from './redis.js';
import { Logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Session authentication mode constants
 */
export const SessionMode = {
  SESSION: 'session',
  TOKEN: 'token'
};

/**
 * Session configuration options
 */
export class SessionConfig {
  /** 
   * @type {string} Authentication mode for protected routes
   * - Supported values: SessionMode.SESSION | SessionMode.TOKEN
   * @default SessionMode.SESSION
   */
  SESSION_MODE;
  /** @type {string} */
  SSO_ENDPOINT_URL;
  /** @type {string} */
  SSO_CLIENT_ID;
  /** @type {string} */
  SSO_CLIENT_SECRET;
  /** @type {string} */
  SSO_SUCCESS_URL;
  /** @type {string} */
  SSO_FAILURE_URL;

  /** @type {number} Session age in milliseconds */
  SESSION_AGE;
  /**
   * @type {string} Session cookie path
   * @default '/'
   */
  SESSION_COOKIE_PATH;
  /** @type {string} Session secret */
  SESSION_SECRET;
  /** 
   * @type {string} 
   * @default 'ibmid:'
   */
  SESSION_PREFIX;
  /** 
   * @type {string} Session key
   * - In the `SessionMode.SESSION` mode, this is the key used to store the user in the session.
   * - In the `SessionMode.TOKEN` mode, this is the key of localStorage where the user is stored.
   * @default 'session_token'
   */
  SESSION_KEY;
  /** 
   * @type {string} Session expiry key
   * - In the `SessionMode.TOKEN` mode, this is the key of localStorage where the session expiry timestamp is stored.
   * @default 'session_expires_at'
   */
  SESSION_EXPIRY_KEY;
  /**
   * @type {string} Path to custom HTML template for TOKEN mode callback
   * - Used to customize the redirect page that stores JWT token and expiry in localStorage
   * - Supports placeholders: {{SESSION_DATA_KEY}}, {{SESSION_DATA_VALUE}}, {{SESSION_EXPIRY_KEY}}, {{SESSION_EXPIRY_VALUE}}, {{SSO_SUCCESS_URL}}, {{SSO_FAILURE_URL}}
   * - If not provided, uses default template
   */
  TOKEN_STORAGE_TEMPLATE_PATH;
  /** @type {string} Redis URL */
  REDIS_URL;
  /** @type {string} Redis certificate path */
  REDIS_CERT_PATH;
  /**
   * @type {string} Algorithm used to encrypt the JWT
   * @default 'dir'
   */
  JWT_ALGORITHM;
  /**
   * @type {string} Encryption algorithm used to encrypt the JWT
   * @default 'A256GCM'
   */
  JWT_ENCRYPTION;
  /**
   * @type {number} Clock tolerance in seconds
   * @default 30
   */
  JWT_CLOCK_TOLERANCE;
  /**
   * @type {string} Hash algorithm used to hash the JWT secret
   * @default 'SHA-256'
   */
  JWT_SECRET_HASH_ALGORITHM;
  /** @type {string?} JWT issuer claim */
  JWT_ISSUER;
  /** @type {string?} JWT audience claim */
  JWT_AUDIENCE;
  /** @type {string?} JWT subject claim */
  JWT_SUBJECT;
}

export class SessionManager {
  /** @type {SessionConfig} */
  #config = null;
  /** @type {Map<string, number>} */
  #sessionRefreshLocks = new Map();
  /** @type {import('./redis.js').RedisManager} */
  #redisManager = null;
  /** @type {import('axios').AxiosInstance} */
  #idpRequest = null;
  /** @type {import('./jwt.js').JwtManager} */
  #jwtManager = null;
  /** @type {import('./logger.js').Logger} */
  #logger = Logger.getInstance('SessionManager');

  /**
   * Create a new session manager
   * @param {SessionConfig} config Session configuration
   */
  constructor(config) {
    this.#config = {
      // Session Mode
      SESSION_MODE: config.SESSION_MODE || SessionMode.SESSION,
      // Session
      SESSION_AGE: config.SESSION_AGE || 64800000,
      SESSION_COOKIE_PATH: config.SESSION_COOKIE_PATH || '/',
      SESSION_SECRET: config.SESSION_SECRET,
      SESSION_PREFIX: config.SESSION_PREFIX || 'ibmid:',
      SESSION_KEY: config.SESSION_KEY || 'session_token',
      SESSION_EXPIRY_KEY: config.SESSION_EXPIRY_KEY || 'session_expires_at',
      TOKEN_STORAGE_TEMPLATE_PATH: config.TOKEN_STORAGE_TEMPLATE_PATH,

      // Identity Provider
      SSO_ENDPOINT_URL: config.SSO_ENDPOINT_URL,
      SSO_CLIENT_ID: config.SSO_CLIENT_ID,
      SSO_CLIENT_SECRET: config.SSO_CLIENT_SECRET,
      SSO_SUCCESS_URL: config.SSO_SUCCESS_URL,
      SSO_FAILURE_URL: config.SSO_FAILURE_URL,
      // Redis
      REDIS_URL: config.REDIS_URL,
      REDIS_CERT_PATH: config.REDIS_CERT_PATH,

      // JWT Manager
      JWT_ALGORITHM: config.JWT_ALGORITHM || 'dir',
      JWT_ENCRYPTION: config.JWT_ENCRYPTION || 'A256GCM',
      JWT_CLOCK_TOLERANCE: config.JWT_CLOCK_TOLERANCE ?? 30,
      JWT_SECRET_HASH_ALGORITHM: config.JWT_SECRET_HASH_ALGORITHM || 'SHA-256',
      JWT_ISSUER: config.JWT_ISSUER,
      JWT_AUDIENCE: config.JWT_AUDIENCE,
      JWT_SUBJECT: config.JWT_SUBJECT,
    };
  }

  /**
   * Check if the email has a session refresh lock
   * @param {string} email Email address
   * @returns {boolean} Returns true if the email has a session refresh lock
   */
  hasLock(email) {
    return this.#sessionRefreshLocks.has(email) && this.#sessionRefreshLocks.get(email) > Date.now();
  }

  /**
   * Lock the email for session refresh
   * @param {string} email Email address
   */
  lock(email) {
    if (email) {
      this.#sessionRefreshLocks.set(email, Date.now() + 60000);
    }
    this.clearLocks();
  }

  /**
   * Clear session refresh locks
   */
  clearLocks() {
    return setTimeout(() => {
      for (const email of this.#sessionRefreshLocks.keys()) {
        if (this.hasLock(email)) {
          continue;
        }
        this.#sessionRefreshLocks.delete(email);
      }
    }, 1000);
  }

  /**
   * Get session key
   * @returns {string} Returns the session key
   */
  #getSessionKey() {
    return this.#config.SESSION_KEY;
  }

  /**
   * Get Redis key for token storage
   * @param {string} email User email
   * @param {string} tid Token ID
   * @returns {string} Returns the Redis key for token storage
   * @private
   */
  #getTokenRedisKey(email, tid) {
    return `${this.#config.SESSION_KEY}:t:${email}:${tid}`;
  }

  /**
   * Get Redis key pattern for all user tokens
   * @param {string} email User email
   * @returns {string} Returns the Redis key pattern for all user tokens
   * @private
   */
  #getTokenRedisPattern(email) {
    return `${this.#config.SESSION_KEY}:t:${email}:*`;
  }

  /**
   * Get RedisManager instance
   * @returns {import('./redis.js').RedisManager} Returns the RedisManager instance
   */
  redisManager() {
    return this.#redisManager;
  }

  /**
   * Generate and store JWT token in Redis
   * - JWT payload contains only { email, tid } for minimal size
   * - Full user data is stored in Redis as single source of truth
   * @param {object} user User object
   * @returns {Promise<string>} Returns the generated JWT token
   * @private
   */
  async #generateAndStoreToken(user) {
    // Generate unique token ID for this device/session
    const tid = crypto.randomUUID();
    const ttlSeconds = Math.floor(this.#config.SESSION_AGE / 1000);
    // Create JWT token with only email and tid (minimal payload)
    const token = await this.#jwtManager.encrypt(
      { email: user.email, tid },
      this.#config.SESSION_SECRET,
      { expirationTime: ttlSeconds }
    );

    // Store user data in Redis with TTL
    const redisKey = this.#getTokenRedisKey(user.email, tid);

    await this.#redisManager.getClient().setEx(
      redisKey,
      ttlSeconds,
      JSON.stringify(user)
    );
    this.#logger.debug(`### TOKEN GENERATED: ${user.email} ###`);
    return token;
  }

  /**
   * Verify token authentication
   * @param {import('@types/express').Request} req Request
   * @param {import('@types/express').Response} res Response
   * @param {import('@types/express').NextFunction} next Next function
   * @param {boolean} isDebugging Debugging flag
   * @param {string} redirectUrl Redirect URL
   * @private
   */
  async #verifyToken(req, res, next, isDebugging, redirectUrl) {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        throw new CustomError(httpCodes.UNAUTHORIZED, 'Missing or invalid authorization header');
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Decrypt JWT token
      const { payload } = await this.#jwtManager.decrypt(
        token,
        this.#config.SESSION_SECRET
      );

      // Extract email and token ID
      const { email, tid } = payload;
      if (!email || !tid) {
        throw new CustomError(httpCodes.UNAUTHORIZED, 'Invalid token payload');
      }

      // Lookup user in Redis
      const redisKey = this.#getTokenRedisKey(email, tid);
      const userData = await this.#redisManager.getClient().get(redisKey);

      if (!userData) {
        throw new CustomError(httpCodes.UNAUTHORIZED, 'Token not found or expired');
      }

      // Parse and attach user to request
      req.user = JSON.parse(userData);
      res.locals.user = req.user;

      // Validate authorization
      const { authorized = isDebugging } = req.user ?? { authorized: isDebugging };
      if (!authorized && !isDebugging) {
        throw new CustomError(httpCodes.FORBIDDEN, 'User is not authorized');
      }

      return next();

    } catch (error) {
      if (isDebugging) {
        this.#logger.warn('### TOKEN VERIFICATION FAILED (debugging mode) ###', error.message);
        return next();
      }

      if (redirectUrl) {
        return res.redirect(redirectUrl);
      }

      // Handle specific JWT errors
      if (error.code === 'ERR_JWT_EXPIRED') {
        return next(new CustomError(httpCodes.UNAUTHORIZED, 'Token expired'));
      }

      return next(error instanceof CustomError ? error : 
        new CustomError(httpCodes.UNAUTHORIZED, 'Token verification failed'));
    }
  }

  /**
   * Verify session authentication
   * @param {import('@types/express').Request} req Request
   * @param {import('@types/express').Response} res Response
   * @param {import('@types/express').NextFunction} next Next function
   * @param {boolean} isDebugging Debugging flag
   * @param {string} redirectUrl Redirect URL
   * @private
   */
  async #verifySession(req, res, next, isDebugging, redirectUrl) {
    const { authorized = isDebugging } = req.user ?? { authorized: isDebugging };
    if (authorized) {
      return next();
    }
    if (redirectUrl) {
      return res.redirect(redirectUrl);
    }
    return next(new CustomError(httpCodes.UNAUTHORIZED, httpMessages.UNAUTHORIZED));
  }

  /**
   * Refresh token authentication
   * @param {import('@types/express').Request} req Request
   * @param {import('@types/express').Response} res Response
   * @param {import('@types/express').NextFunction} next Next function
   * @param {(user: object) => object} initUser Initialize user function
   * @param {string} idpUrl Identity provider URL
   * @private
   */
  async #refreshToken(req, res, next, initUser, idpUrl) {
    try {
      // Get current user from verifyToken middleware
      const { email, attributes } = req.user || {};

      if (!email) {
        throw new CustomError(httpCodes.UNAUTHORIZED, 'User not authenticated');
      }

      // Extract Token ID from current token
      const authHeader = req.headers.authorization;
      const token = authHeader?.substring(7);
      const { payload } = await this.#jwtManager.decrypt(token, this.#config.SESSION_SECRET);
      const { tid: oldTokenId } = payload;

      // Check refresh lock
      if (this.hasLock(email)) {
        throw new CustomError(httpCodes.CONFLICT, 'Token refresh is locked');
      }
      this.lock(email);

      // Call SSO refresh endpoint
      const response = await this.#idpRequest.post(idpUrl, {
        user: {
          email,
          attributes: {
            idp: attributes?.idp,
            refresh_token: attributes?.refresh_token
          }
        }
      });

      if (response.status !== httpCodes.OK) {
        throw new CustomError(response.status, response.statusText);
      }

      // Decrypt new user data from SSO
      const { jwt } = response.data;
      const { payload: newPayload } = await this.#jwtManager.decrypt(jwt, this.#config.SSO_CLIENT_SECRET);

      if (!newPayload?.user) {
        throw new CustomError(httpCodes.BAD_REQUEST, 'Invalid JWT payload from SSO');
      }

      // Initialize user with new data
      const user = initUser(newPayload.user);

      // Generate new token
      const newToken = await this.#generateAndStoreToken(user);

      // Remove old token from Redis
      const oldRedisKey = this.#getTokenRedisKey(email, oldTokenId);
      await this.#redisManager.getClient().del(oldRedisKey);

      this.#logger.debug('### TOKEN REFRESHED SUCCESSFULLY ###');

      // Return new token
      return res.json({
        token: newToken,
        user,
        expiresIn: Math.floor(this.#config.SESSION_AGE / 1000),
        tokenType: 'Bearer'
      });
    } catch (error) {
      return next(httpHelper.handleAxiosError(error));
    }
  }

  /**
   * Refresh session authentication
   * @param {import('@types/express').Request} req Request
   * @param {import('@types/express').Response} res Response
   * @param {import('@types/express').NextFunction} next Next function
   * @param {(user: object) => object} initUser Initialize user function
   * @param {string} idpUrl Identity provider URL
   * @private
   */
  async #refreshSession(req, res, next, initUser, idpUrl) {
    try {
      const { email, attributes } = req.user || { email: '', attributes: {} };
      if (this.hasLock(email)) {
        throw new CustomError(httpCodes.CONFLICT, 'User refresh is locked');
      }
      this.lock(email);
      const response = await this.#idpRequest.post(idpUrl, {
        user: {
          email,
          attributes: {
            idp: attributes?.idp,
            refresh_token: attributes?.refresh_token
          }
        }
      });
      if (response.status === httpCodes.OK) {
        const { jwt } = response.data;
        const payload = await this.#saveSession(req, jwt, initUser);
        return res.json(payload);
      }
      throw new CustomError(response.status, response.statusText);
    } catch (error) {
      return next(httpHelper.handleAxiosError(error));
    }
  }

  /**
   * Logout all tokens for a user
   * @param {import('@types/express').Request} req Request
   * @param {import('@types/express').Response} res Response
   * @param {boolean} isRedirect Whether to redirect
   * @private
   */
  async #logoutAllTokens(req, res, isRedirect) {
    try {
      const { email } = req.user || {};

      if (!email) {
        throw new CustomError(httpCodes.UNAUTHORIZED, 'User not authenticated');
      }

      // Find all tokens for this user
      const pattern = this.#getTokenRedisPattern(email);
      const keys = await this.#redisManager.getClient().keys(pattern);

      // Delete all tokens
      if (keys.length > 0) {
        await this.#redisManager.getClient().del(keys);
      }

      this.#logger.info(`### ALL TOKENS LOGGED OUT: ${email} (${keys.length} tokens) ###`);

      if (isRedirect) {
        return res.redirect(this.#config.SSO_SUCCESS_URL);
      }
      return res.json({ 
        message: 'All tokens logged out successfully',
        tokensRemoved: keys.length,
        redirect_url: this.#config.SSO_SUCCESS_URL
      });
    } catch (error) {
      this.#logger.error('### LOGOUT ALL TOKENS ERROR ###', error);
      if (isRedirect) {
        return res.redirect(this.#config.SSO_FAILURE_URL);
      }
      return res.status(httpCodes.SYSTEM_FAILURE).json({ 
        error: 'Logout all failed',
        redirect_url: this.#config.SSO_FAILURE_URL
      });
    }
  }

  /**
   * Logout token authentication
   * @param {import('@types/express').Request} req Request
   * @param {import('@types/express').Response} res Response
   * @param {boolean} isRedirect Whether to redirect
   * @param {boolean} logoutAll Whether to logout all tokens
   * @private
   */
  async #logoutToken(req, res, isRedirect, logoutAll = false) {
    // If logoutAll is true, delegate to the all tokens logout method
    if (logoutAll) {
      return this.#logoutAllTokens(req, res, isRedirect);
    }

    try {
      // Extract Token ID from current token
      const authHeader = req.headers.authorization;
      const token = authHeader?.substring(7);

      if (!token) {
        throw new CustomError(httpCodes.BAD_REQUEST, 'No token provided');
      }

      const { payload } = await this.#jwtManager.decrypt(token, this.#config.SESSION_SECRET);
      const { email, tid } = payload;

      if (!email || !tid) {
        throw new CustomError(httpCodes.BAD_REQUEST, 'Invalid token payload');
      }

      // Remove token from Redis
      const redisKey = this.#getTokenRedisKey(email, tid);
      await this.#redisManager.getClient().del(redisKey);

      this.#logger.info('### TOKEN LOGOUT SUCCESSFULLY ###');

      if (isRedirect) {
        return res.redirect(this.#config.SSO_SUCCESS_URL);
      }
      return res.json({ 
        message: 'Logout successful',
        redirect_url: this.#config.SSO_SUCCESS_URL
      });

    } catch (error) {
      this.#logger.error('### TOKEN LOGOUT ERROR ###', error);
      if (isRedirect) {
        return res.redirect(this.#config.SSO_FAILURE_URL);
      }
      return res.status(httpCodes.SYSTEM_FAILURE).json({ 
        error: 'Logout failed',
        redirect_url: this.#config.SSO_FAILURE_URL
      });
    }
  }

  /**
   * Logout session authentication
   * @param {import('@types/express').Request} req Request
   * @param {import('@types/express').Response} res Response
   * @param {Function} callback Callback function
   * @private
   */
  #logoutSession(req, res, callback) {
    try {
      res.clearCookie('connect.sid');
    } catch (error) {
      this.#logger.error('### CLEAR COOKIE ERROR ###');
      this.#logger.error(error);
    }
    return req.session.destroy((sessionError) => {
      if (sessionError) {
        this.#logger.error('### SESSION DESTROY CALLBACK ERROR ###');
        this.#logger.error(sessionError);
        return callback(sessionError);
      }
      this.#logger.info('### SESSION LOGOUT SUCCESSFULLY ###');
      return callback(null);
    });
  }

  /**
   * Setup the session/user handlers with configurations
   * @param {import('@types/express').Application} app Express application
   * @param {(user: object) => object} updateUser Update user object if user should have proper attributes, e.g. permissions, avatar URL
   */
  async setup(app, updateUser) {
    this.#redisManager = new RedisManager();
    this.#jwtManager = new JwtManager(this.#config);
    // Identity Provider Request
    this.#idpRequest = axios.create({
      baseURL: this.#config.SSO_ENDPOINT_URL,
      timeout: 30000,
    });
    app.set('trust proxy', 1);
    app.use(await this.#sessionHandler());
    app.use(this.#userHandler(updateUser));
  }

  /**
   * Get Redis session RequestHandler
   * @returns {import('@types/express').RequestHandler} Returns RequestHandler instance of Express
   */
  #redisSession() {
    // Redis Session
    this.#logger.log('### Using Redis as the Session Store ###');
    return session({
      cookie: { maxAge: this.#config.SESSION_AGE, path: this.#config.SESSION_COOKIE_PATH, sameSite: false },
      store: new RedisStore({ client: this.#redisManager.getClient(), prefix: this.#config.SESSION_PREFIX, disableTouch: true }),
      resave: false, saveUninitialized: false,
      secret: this.#config.SESSION_SECRET,
    });
  }

  /**
   * Get Memory session RequestHandler
   * @returns {import('@types/express').RequestHandler} Returns RequestHandler instance of Express
   */
  #memorySession() {
    // Memory Session
    this.#logger.log('### Using Memory as the Session Store ###');
    const MemoryStore = memStore(session);
    return session({
      cookie: { maxAge: this.#config.SESSION_AGE, path: this.#config.SESSION_COOKIE_PATH, sameSite: false },
      store: new MemoryStore({}),
      resave: false, saveUninitialized: false,
      secret: this.#config.SESSION_SECRET,
    });
  }

  /**
   * Get session RequestHandler
   * @returns {Promise<import('@types/express').RequestHandler>} Returns RequestHandler instance of Express
   */
  async #sessionHandler() {
    if(this.#config.REDIS_URL?.length > 0) {
      await this.#redisManager.connect(this.#config.REDIS_URL, this.#config.REDIS_CERT_PATH);
      return this.#redisSession();
    }
    return this.#memorySession();
  }

  /**
   * User HTTP Handler
   * @param {(user: object) => object} updateUser User wrapper
   * @returns {import('@types/express').RequestHandler} Returns express Request Handler
   */
  #userHandler (updateUser) {
    return (req, res, next) => {
      req.user = req.session[this.#getSessionKey()];
      /** @type {import('@types/express').Request & { user: object }} Session user */
      res.locals.user = updateUser(req.user);
      return next();
    };
  }

  /**
   * Resource protection based on configured SESSION_MODE
   * @param {boolean} [isDebugging=false] Debugging flag
   * @param {string} [redirectUrl=''] Redirect URL
   * @returns {import('@types/express').RequestHandler} Returns express Request Handler
   */
  authenticate(isDebugging = false, redirectUrl = '') {
    return async (req, res, next) => {
      const mode = this.#config.SESSION_MODE || SessionMode.SESSION;
      if (mode === SessionMode.TOKEN) {
        return this.#verifyToken(req, res, next, isDebugging, redirectUrl);
      }
      return this.#verifySession(req, res, next, isDebugging, redirectUrl);
    };
  }

  /**
   * Resource protection by token (explicit token verification)
   * @param {boolean} [isDebugging=false] Debugging flag
   * @param {string} [redirectUrl=''] Redirect URL
   * @returns {import('@types/express').RequestHandler} Returns express Request Handler
   */
  verifyToken(isDebugging = false, redirectUrl = '') {
    return async (req, res, next) => {
      return this.#verifyToken(req, res, next, isDebugging, redirectUrl);
    };
  }

  /**
   * Resource protection by session (explicit session verification)
   * @param {boolean} [isDebugging=false] Debugging flag
   * @param {string} [redirectUrl=''] Redirect URL
   * @returns {import('@types/express').RequestHandler} Returns express Request Handler
   */
  verifySession(isDebugging = false, redirectUrl = '') {
    return async (req, res, next) => {
      return this.#verifySession(req, res, next, isDebugging, redirectUrl);
    };
  }

  /**
   * Save session
   * @param {import('@types/express').Request} request Request object
   * @param {string} jwt JWT
   * @param {(user: object) => object} initUser Redirect URL
   * @returns {Promise<{ user: import('../models/types/user').UserModel, redirect_url: string }>} Promise
   */
  #saveSession = async (request, jwt, initUser) => {
    /** @type {{ payload: { user: import('../models/types/user').UserModel, redirect_url: string } }} */
    const { payload } = await this.#jwtManager.decrypt(jwt, this.#config.SSO_CLIENT_SECRET);
    if (payload?.user) {
      this.#logger.debug('### CALLBACK USER ###');
      request.session[this.#getSessionKey()] = initUser(payload.user);
      return new Promise((resolve, reject) => {
        request.session.touch().save((err) => {
          if (err) {
            this.#logger.error('### SESSION SAVE ERROR ###');
            this.#logger.error(err);
            return reject(new CustomError(httpCodes.SYSTEM_FAILURE,  'Session failed to save', err));
          }
          return resolve(payload);
        });
      });
    }
    throw new CustomError(httpCodes.BAD_REQUEST, 'Invalid JWT payload');
  };

  /**
   * SSO callback for successful login
   * @param {(user: object) => object} initUser Initialize user object function
   * @returns {import('@types/express').RequestHandler} Returns express Request Handler
   */
  callback(initUser) {
    return async (req, res, next) => {
      const { jwt = '' } = req.query;
      if (!jwt) {
        return next(new CustomError(httpCodes.BAD_REQUEST, 'Missing `jwt` in query parameters'));
      }

      try {
        // Decrypt JWT from Identity Adapter
        const { payload } = await this.#jwtManager.decrypt(jwt, this.#config.SSO_CLIENT_SECRET);
        
        if (!payload?.user) {
          throw new CustomError(httpCodes.BAD_REQUEST, 'Invalid JWT payload');
        }

        /** @type {import('../index.js').SessionUser} */
        const user = initUser(payload.user);
        /** @type {string} */
        const redirectUrl = payload.redirect_url || this.#config.SSO_SUCCESS_URL;

        // Check SESSION_MODE to determine response type
        if (this.#config.SESSION_MODE === SessionMode.TOKEN) {
          // Token-based: Generate token and return HTML page that stores it
          const token = await this.#generateAndStoreToken(user);

          this.#logger.debug('### CALLBACK TOKEN GENERATED ###');

          const templatePath = this.#config.TOKEN_STORAGE_TEMPLATE_PATH || path.resolve(__dirname, 'assets', 'template.html');
          // Return HTML page that stores token in localStorage and redirects
          const template = fs.readFileSync(templatePath, 'utf8');
          const html = template
            .replaceAll('{{SESSION_DATA_KEY}}', this.#config.SESSION_KEY)
            .replaceAll('{{SESSION_DATA_VALUE}}', token)
            .replaceAll('{{SESSION_EXPIRY_KEY}}', this.#config.SESSION_EXPIRY_KEY)
            .replaceAll('{{SESSION_EXPIRY_VALUE}}', user.attributes.expires_at)
            .replaceAll('{{SSO_SUCCESS_URL}}', redirectUrl)
            .replaceAll('{{SSO_FAILURE_URL}}', this.#config.SSO_FAILURE_URL);
          return res.send(html);
        }
        // Session-based: Save to session and redirect
        await this.#saveSession(req, jwt, initUser);
        return res.redirect(redirectUrl);
      }
      catch (error) {
        this.#logger.error('### CALLBACK ERROR ###', error);
        return res.redirect(this.#config.SSO_FAILURE_URL.concat('?message=').concat(encodeURIComponent(error.message)));
      }
    };
  }

  /**
   * Get Identity Providers
   * @returns {import('@types/express').RequestHandler} Returns express Request Handler
   */
  identityProviders() {
    const idpUrl = '/auth/providers'.concat('?client_id=').concat(this.#config.SSO_CLIENT_ID);
    return async (_req, res, next) => {
      try {
        const response = await this.#idpRequest.get(idpUrl);
        if(response.status === httpCodes.OK) {
          return res.json(response.data);
        }
        throw new CustomError(response.status, response.statusText);
      }
      catch(error) {
        return next(httpHelper.handleAxiosError(error));
      }
    };
  }

  /**
   * Refresh user authentication based on configured SESSION_MODE
   * @param {(user: object) => object} initUser Initialize user object function
   * @returns {import('@types/express').RequestHandler} Returns express Request Handler
   */
  refresh(initUser) {
    const idpUrl = '/auth/refresh'.concat('?client_id=').concat(this.#config.SSO_CLIENT_ID);
    return async (req, res, next) => {
      const mode = this.#config.SESSION_MODE || SessionMode.SESSION;
      
      if (mode === SessionMode.TOKEN) {
        return this.#refreshToken(req, res, next, initUser, idpUrl);
      } else {
        return this.#refreshSession(req, res, next, initUser, idpUrl);
      }
    };
  }

  /**
   * Application logout based on configured SESSION_MODE (NOT SSO)
   * @returns {import('@types/express').RequestHandler} Returns express Request Handler
   */
  logout() {
    return async (req, res) => {
      const { redirect = false, all = false } = req.query;
      const isRedirect = (redirect === 'true' || redirect === true);
      const logoutAll = (all === 'true' || all === true);
      const mode = this.#config.SESSION_MODE || SessionMode.SESSION;
      
      if (mode === SessionMode.TOKEN) {
        return this.#logoutToken(req, res, isRedirect, logoutAll);
      }

      // Note: 'all' parameter is only applicable for token-based authentication
      // Session-based authentication is already single-instance per cookie
      return this.#logoutSession(req, res, (error) => {
        if (error) {
          this.#logger.error('### LOGOUT CALLBACK ERROR ###');
          this.#logger.error(error);
          if (isRedirect) {
            return res.redirect(this.#config.SSO_FAILURE_URL);
          }
          return res.status(httpCodes.AUTHORIZATION_FAILED).send({ 
            redirect_url: this.#config.SSO_FAILURE_URL 
          });
        }
        if (isRedirect) {
          return res.redirect(this.#config.SSO_SUCCESS_URL);
        }
        return res.send({ redirect_url: this.#config.SSO_SUCCESS_URL });
      });
    };
  }

}
