import axios from 'axios';
import session from 'express-session';
import { jwtDecrypt } from 'jose';
import { RedisStore } from 'connect-redis';
import memStore from 'memorystore';

import { CustomError, httpCodes, httpHelper, httpMessages } from './http-handlers.js';
import { RedisManager } from './redis.js';

const MemoryStore = memStore(session);

export class SessionConfig {
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
   * Get RedisManager instance
   * @returns {import('./redis.js').RedisManager} Returns the RedisManager instance
   */
  redisManager() {
    return this.#redisManager;
  }

  /**
   * Setup the session/user handlers with configurations
   * @param {import('@types/express').Application} app Express application
   * @param {SessionConfig} config Redis configurations
   * @param {(user: object) => object} updateUser Update user object if user should have proper attributes, e.g. permissions, avatar URL
   */
  async setup(app, config, updateUser) {
    this.#redisManager = new RedisManager();
    this.#config = {
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
    };
    // Identity Provider Request
    this.#idpRequest = axios.create({
      baseURL: this.#config.SSO_ENDPOINT_URL,
      timeout: 30000,
    });
    app.set('trust proxy', 1);
    app.use(await this.sessionHandler());
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
  async sessionHandler() {
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
   * Resource protection
   * @param {boolean} [isDebugging=false] Debugging flag
   * @param {boolean} [redirectUrl=''] Redirect flag
   * @returns {import('@types/express').RequestHandler} Returns express Request Handler
   */
  authenticate (isDebugging = false, redirectUrl = '') {
    return async (req, res, next) => {
      /** @type {{ authorized: boolean }} */
      const { authorized = isDebugging } = req.user ?? { authorized: isDebugging };
      if (authorized) {
        return next();
      }
      if(redirectUrl) {
        return res.redirect(redirectUrl);
      }
      return next(new CustomError(httpCodes.UNAUTHORIZED, httpMessages.UNAUTHORIZED));
    };
  };

  /**
   * Save session
   * @param {import('@types/express').Request} request Request object
   * @param {string} jwt JWT
   * @param {(user: object) => object} initUser Redirect URL
   * @returns {Promise<{ user: import('../models/types/user').UserModel, redirect_url: string }>} Promise
   */
  #saveSession = async (request, jwt, initUser) => {
    /** @type {{ payload: { user: import('../models/types/user').UserModel, redirect_url: string } }} */
    const { payload } = await this.#decryptJWT(jwt, this.#config.SSO_CLIENT_SECRET);
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
      if(!jwt) {
        return next(new CustomError(httpCodes.BAD_REQUEST, 'Missing `jwt` in query parameters'));
      }
      try {
        const payload = await this.#saveSession(req, jwt, initUser);
        return res.redirect(payload?.redirect_url ? payload.redirect_url : this.#config.SSO_SUCCESS_URL);
      }
      catch (error) {
        console.error('### LOGIN ERROR ###');
        console.error(error);
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
   * Application logout (NOT SSO)
   * @returns {import('@types/express').RequestHandler} Returns express Request Handler
   */
  logout() {
    return (req, res) => {
      const { redirect = false } = req.query;
      const isRedirect = (redirect === 'true' || redirect === true);
      return this.#logout(req, res, (error => {
        if (error) {
          console.error('### LOGOUT CALLBACK ERROR ###');
          console.error(error);
          if (isRedirect)
            return res.redirect(this.#config.SSO_FAILURE_URL);
          return res.status(httpCodes.AUTHORIZATION_FAILED).send({ redirect_url: this.#config.SSO_FAILURE_URL });
        }
        if (isRedirect)
          return res.redirect(this.#config.SSO_SUCCESS_URL);
        return res.send({ redirect_url: this.#config.SSO_SUCCESS_URL });
      }));
    };
  }

  /**
   * Refresh user session
   * @param {(user: object) => object} initUser Initialize user object function
   * @returns {import('@types/express').RequestHandler} Returns express Request Handler
   */
  refresh(initUser) {
    const idpUrl = '/auth/refresh'.concat('?client_id=').concat(this.#config.SSO_CLIENT_ID);
    return async (req, res, next) => {
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
            },
          }
        });
        if(response.status === httpCodes.OK) {
          /** @type {{ jwt: string }} */
          const { jwt } = response.data;
          const payload = await this.#saveSession(req, jwt, initUser);
          return res.json(payload);
        }
        throw new CustomError(response.status, response.statusText);
      }
      catch(error) {
        return next(httpHelper.handleAxiosError(error));
      }
    };
  }

  /**
   * Logout
   * @param {import('@types/express').Request} req Request
   * @param {import('@types/express').Response} res Response
   * @param {(error: Error)} callback Callback
   */
  #logout(req, res, callback) {
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
      console.info('### LOGOUT SUCCESSFULLY ###');
      return callback(null);
    });
  }

  /**
   * Decrypt JWT data for user session
   * @param {string} data JWT data
   * @param {string} input Input string for encryption
   * @returns {Promise<import('jose').JWTDecryptResult<import('jose').EncryptJWT>>} Returns decrypted JWT payload
   */
  async #decryptJWT(data, input) {
    const secret = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(input)
    );
    return await jwtDecrypt(data, new Uint8Array(secret), { clockTolerance: 30 });
  }
}
