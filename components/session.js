import crypto from 'node:crypto';
import axios from 'axios';
import session from 'express-session';
import memStore from 'memorystore';
import { RedisStore } from 'connect-redis';

import { CustomError, httpCodes, httpHelper, httpMessages } from './http-handlers.js';
import { JwtManager } from './jwt.js';
import { RedisManager } from './redis.js';

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
   * @type {string} 
   * Authentication mode for protected routes
   * Supported values: SessionMode.SESSION | SessionMode.TOKEN
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

  /** @type {number} */
  SESSION_AGE;
  /** @type {string} */
  SESSION_COOKIE_PATH;
  /** @type {string} */
  SESSION_SECRET;
  /** @type {string} */
  SESSION_PREFIX;

  /** @type {string} */
  REDIS_URL;
  /** @type {string} */
  REDIS_CERT_PATH;

  /** @type {string} */
  JWT_ALGORITHM;
  /** @type {string} */
  JWT_ENCRYPTION;
  /** @type {string} */
  JWT_EXPIRATION_TIME;
  /** @type {number} */
  JWT_CLOCK_TOLERANCE;
  /** @type {string} */
  JWT_SECRET_HASH_ALGORITHM;
  /** @type {string} */
  JWT_ISSUER;
  /** @type {string} */
  JWT_AUDIENCE;
  /** @type {string} */
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
      JWT_EXPIRATION_TIME: config.JWT_EXPIRATION_TIME || '10m',
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
    return 'user';
  }

  /**
   * Get Redis key for token storage
   * @param {string} email User email
   * @param {string} tokenId Token ID
   * @returns {string} Returns the Redis key for token storage
   * @private
   */
  #getTokenRedisKey(email, tokenId) {
    return `${this.#config.SESSION_PREFIX}token:${email}:${tokenId}`;
  }

  /**
   * Get Redis key pattern for all user tokens
   * @param {string} email User email
   * @returns {string} Returns the Redis key pattern for all user tokens
   * @private
   */
  #getTokenRedisPattern(email) {
    return `${this.#config.SESSION_PREFIX}token:${email}:*`;
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
   * @param {object} user User object
   * @returns {Promise<string>} Returns the generated JWT token
   * @private
   */
  async #generateAndStoreToken(user) {
    // Generate unique token ID for this device/session
    const tokenId = crypto.randomUUID();
    
    // Create JWT token with email and tokenId
    const token = await this.#jwtManager.encrypt(
      { 
        email: user.email, 
        tokenId 
      },
      this.#config.SESSION_SECRET,
      { expirationTime: this.#config.JWT_EXPIRATION_TIME }
    );
    
    // Store user data in Redis with TTL
    const redisKey = this.#getTokenRedisKey(user.email, tokenId);
    const ttlSeconds = Math.floor(this.#config.SESSION_AGE / 1000);
    
    await this.#redisManager.getClient().setEx(
      redisKey,
      ttlSeconds,
      JSON.stringify(user)
    );
    
    console.debug(`### TOKEN GENERATED: ${user.email} ###`);
    
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

      // Extract email and tokenId
      const { email, tokenId } = payload;
      if (!email || !tokenId) {
        throw new CustomError(httpCodes.UNAUTHORIZED, 'Invalid token payload');
      }

      // Lookup user in Redis
      const redisKey = this.#getTokenRedisKey(email, tokenId);
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
        console.warn('### TOKEN VERIFICATION FAILED (debugging mode) ###', error.message);
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

      // Extract tokenId from current token
      const authHeader = req.headers.authorization;
      const token = authHeader?.substring(7);
      const { payload } = await this.#jwtManager.decrypt(token, this.#config.SESSION_SECRET);
      const oldTokenId = payload.tokenId;

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

      console.debug('### TOKEN REFRESHED SUCCESSFULLY ###');

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

      console.info(`### ALL TOKENS LOGGED OUT: ${email} (${keys.length} tokens) ###`);

      if (isRedirect) {
        return res.redirect(this.#config.SSO_SUCCESS_URL);
      }
      return res.json({ 
        message: 'All tokens logged out successfully',
        tokensRemoved: keys.length,
        redirect_url: this.#config.SSO_SUCCESS_URL
      });
    } catch (error) {
      console.error('### LOGOUT ALL TOKENS ERROR ###', error);
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
      // Extract tokenId from current token
      const authHeader = req.headers.authorization;
      const token = authHeader?.substring(7);

      if (!token) {
        throw new CustomError(httpCodes.BAD_REQUEST, 'No token provided');
      }

      const { payload } = await this.#jwtManager.decrypt(token, this.#config.SESSION_SECRET);
      const { email, tokenId } = payload;

      // Remove token from Redis
      const redisKey = this.#getTokenRedisKey(email, tokenId);
      await this.#redisManager.getClient().del(redisKey);

      console.info('### TOKEN LOGOUT SUCCESSFULLY ###');

      if (isRedirect) {
        return res.redirect(this.#config.SSO_SUCCESS_URL);
      }
      return res.json({ 
        message: 'Logout successful',
        redirect_url: this.#config.SSO_SUCCESS_URL
      });

    } catch (error) {
      console.error('### TOKEN LOGOUT ERROR ###', error);
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
      console.error('### CLEAR COOKIE ERROR ###');
      console.error(error);
    }
    return req.session.destroy((sessionError) => {
      if (sessionError) {
        console.error('### SESSION DESTROY CALLBACK ERROR ###');
        console.error(sessionError);
        return callback(sessionError);
      }
      console.info('### SESSION LOGOUT SUCCESSFULLY ###');
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
    console.log('### Using Redis as the Session Store ###');
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
    console.log('### Using Memory as the Session Store ###');
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
      console.debug('### CALLBACK USER ###');
      request.session[this.#getSessionKey()] = initUser(payload.user);
      return new Promise((resolve, reject) => {
        request.session.touch().save((err) => {
          if (err) {
            console.error('### SESSION SAVE ERROR ###');
            console.error(err);
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

        const user = initUser(payload.user);
        const redirectUrl = payload.redirect_url || this.#config.SSO_SUCCESS_URL;

        // Check SESSION_MODE to determine response type
        if (this.#config.SESSION_MODE === SessionMode.TOKEN) {
          // Token-based: Generate token and return HTML page that stores it
          const token = await this.#generateAndStoreToken(user);

          console.debug('### CALLBACK TOKEN GENERATED ###');

          // Return HTML page that stores token in localStorage and redirects
          return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>Authentication Complete</title>
              <script>
                (function() {
                  try {
                    // Store auth data in localStorage
                    localStorage.setItem('authToken', ${JSON.stringify(token)});
                    localStorage.setItem('tokenExpiry', ${Date.now() + this.#config.SESSION_AGE});
                    localStorage.setItem('user', ${JSON.stringify({
                      email: user.email,
                      name: user.name,
                    })});
                    
                    // Redirect to original destination
                    window.location.replace(${JSON.stringify(redirectUrl)});
                  } catch (error) {
                    console.error('Failed to store authentication:', error);
                    document.getElementById('error').style.display = 'block';
                  }
                })();
              </script>
              <style>
                body { font-family: system-ui, sans-serif; text-align: center; padding: 50px; }
                #error { display: none; color: #d32f2f; margin-top: 20px; }
              </style>
            </head>
            <body>
              <p>Completing authentication...</p>
              <div id="error">
                <p>Authentication failed. Please try again.</p>
                <a href="${this.#config.SSO_FAILURE_URL}">Return to login</a>
              </div>
            </body>
            </html>
          `);
        }
        else {
          // Session-based: Save to session and redirect
          await this.#saveSession(req, jwt, initUser);
          return res.redirect(redirectUrl);
        }
      }
      catch (error) {
        console.error('### CALLBACK ERROR ###', error);
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
          console.error('### LOGOUT CALLBACK ERROR ###');
          console.error(error);
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
