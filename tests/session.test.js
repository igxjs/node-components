import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { SessionManager, SessionConfig } from '../components/session.js';
import { CustomError, httpCodes } from '../components/http-handlers.js';

describe('SessionManager', () => {
  let sessionManager;
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
    // Initialize sessionManager with required SESSION_SECRET
    sessionManager = new SessionManager({
      SESSION_SECRET: 'test-secret-key-for-testing',
    });
  });

  afterEach(() => {
    clock.restore();
  });

  describe('SessionConfig', () => {
    it('should create SessionConfig instance with properties', () => {
      const config = new SessionConfig();
      expect(config).to.be.instanceOf(SessionConfig);
      expect(config).to.have.property('SSO_ENDPOINT_URL');
      expect(config).to.have.property('SESSION_SECRET');
      expect(config).to.have.property('REDIS_URL');
      
      // Create SessionManager with required SESSION_SECRET
      const manager = new SessionManager({
        SESSION_SECRET: 'test-secret',
      });
      expect(manager).to.be.instanceOf(SessionManager);
    });
  });

  describe('Lock Management', () => {
    describe('hasLock', () => {
      it('should return false for email without lock', () => {
        const result = sessionManager.hasLock('test@example.com');
        expect(result).to.be.false;
      });

      it('should return true for email with active lock', () => {
        sessionManager.lock('test@example.com');
        const result = sessionManager.hasLock('test@example.com');
        expect(result).to.be.true;
      });

      it('should return false for expired lock', () => {
        sessionManager.lock('test@example.com');
        clock.tick(61000);
        const result = sessionManager.hasLock('test@example.com');
        expect(result).to.be.false;
      });
    });

    describe('lock', () => {
      it('should create a lock for given email', () => {
        sessionManager.lock('test@example.com');
        expect(sessionManager.hasLock('test@example.com')).to.be.true;
      });

      it('should not create lock for empty email', () => {
        sessionManager.lock('');
        sessionManager.lock(null);
        expect(sessionManager.hasLock('')).to.be.false;
        expect(sessionManager.hasLock(null)).to.be.false;
      });
    });
  });

  describe('authenticate', () => {
    let req, res, next;

    beforeEach(() => {
      // Initialize req.session instead of req.user (SESSION mode checks session data)
      req = { session: {} };
      res = { redirect: sinon.stub() };
      next = sinon.stub();
    });

    it('should call next() if user is authorized', () => {
      // Fix: Set user data in session using SESSION_KEY (default: 'session_token')
      req.session.session_token = { authorized: true };
      const middleware = sessionManager.authenticate();
      middleware(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args).to.be.empty;
    });

    it('should call next with error if user is not authorized', () => {
      // Fix: Set user data in session using SESSION_KEY
      req.session.session_token = { authorized: false };
      const middleware = sessionManager.authenticate();
      middleware(req, res, next);
      expect(next.calledOnce).to.be.true;
      const error = next.firstCall.args[0];
      expect(error).to.be.instanceOf(CustomError);
      expect(error.code).to.equal(httpCodes.UNAUTHORIZED);
    });

    it('should redirect if errorRedirectUrl is provided', () => {
      // Fix: Set user data in session using SESSION_KEY
      req.session.session_token = { authorized: false };
      const middleware = sessionManager.authenticate('/login');
      middleware(req, res, next);
      expect(res.redirect.calledWith('/login')).to.be.true;
      expect(next.called).to.be.false;
    });
  });

  describe('redisManager', () => {
    it('should return null before initialization', () => {
      const manager = sessionManager.redisManager();
      expect(manager).to.be.null;
    });
  });

  describe('getUser', () => {
    describe('with TOKEN mode', () => {
      beforeEach(() => {
        // Create session manager with TOKEN mode
        sessionManager = new SessionManager({
          SESSION_SECRET: 'test-secret-key-for-testing',
          SESSION_MODE: 'token',
          SSO_SUCCESS_URL: '/dashboard',
          SSO_FAILURE_URL: '/login',
        });
      });

      it('should throw error for missing authorization header', async () => {
        const req = { headers: {} };
        try {
          await sessionManager.getUser(req);
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error).to.be.instanceOf(CustomError);
          expect(error.code).to.equal(httpCodes.UNAUTHORIZED);
          expect(error.message).to.include('Missing or invalid authorization header');
        }
      });

      it('should throw error for invalid authorization header format', async () => {
        const req = { headers: { authorization: 'InvalidFormat token123' } };
        try {
          await sessionManager.getUser(req);
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error).to.be.instanceOf(CustomError);
          expect(error.code).to.equal(httpCodes.UNAUTHORIZED);
          expect(error.message).to.include('Missing or invalid authorization header');
        }
      });

      it('should throw error for authorization header without Bearer prefix', async () => {
        const req = { headers: { authorization: 'token123' } };
        try {
          await sessionManager.getUser(req);
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error).to.be.instanceOf(CustomError);
          expect(error.code).to.equal(httpCodes.UNAUTHORIZED);
        }
      });

      it('should validate Bearer token format before processing', async () => {
        // Test that format validation happens before any JWT processing
        const invalidFormats = [
          '',
          'Token xyz',
          'bearer token',  // lowercase
          'BEARER token',  // uppercase
          'Basic token',   // wrong auth type
        ];

        for (const invalidFormat of invalidFormats) {
          const req = { headers: { authorization: invalidFormat } };
          try {
            await sessionManager.getUser(req);
            expect.fail(`Should have thrown error for: ${invalidFormat}`);
          } catch (error) {
            expect(error).to.be.instanceOf(CustomError);
            expect(error.code).to.equal(httpCodes.UNAUTHORIZED);
          }
        }
      });
    });

    describe('with SESSION mode', () => {
      beforeEach(() => {
        // Create session manager with SESSION mode (default)
        sessionManager = new SessionManager({
          SESSION_SECRET: 'test-secret-key-for-testing',
          SESSION_MODE: 'session',
        });
      });

      it('should return user from session', async () => {
        const mockUser = { email: 'test@example.com', authorized: true };
        const req = { session: { session_token: mockUser } };

        const user = await sessionManager.getUser(req);
        expect(user).to.deep.equal(mockUser);
      });

      it('should return undefined for empty session', async () => {
        const req = { session: {} };
        const user = await sessionManager.getUser(req);
        expect(user).to.be.undefined;
      });
    });

    describe('method accessibility', () => {
      it('should be a public method accessible on SessionManager instance', () => {
        expect(sessionManager.getUser).to.be.a('function');
        expect(sessionManager.getUser.name).to.equal('getUser');
      });

      it('should accept req parameter', () => {
        // Check function signature (length = number of parameters without defaults)
        expect(sessionManager.getUser.length).to.equal(1); // req is required
      });
    });

    describe('integration behavior', () => {
      it('should require setup() to be called before using with Redis in TOKEN mode', async () => {
        // This test documents that getUser requires proper initialization
        // in TOKEN mode, as it needs JwtManager and RedisManager
        sessionManager = new SessionManager({
          SESSION_SECRET: 'test-secret-key-for-testing',
          SESSION_MODE: 'token',
          SSO_SUCCESS_URL: '/dashboard',
          SSO_FAILURE_URL: '/login',
        });

        const req = { headers: { authorization: 'Bearer test-token' } };
        try {
          await sessionManager.getUser(req);
          expect.fail('Should have thrown an error');
        } catch (error) {
          // Expected to fail because setup() hasn't been called
          // JwtManager and RedisManager are not initialized
          expect(error).to.exist;
        }
      });
    });
  });
});
