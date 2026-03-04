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
      sessionManager = new SessionManager(config);
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
      req = { user: null };
      res = { redirect: sinon.stub() };
      next = sinon.stub();
    });

    it('should call next() if user is authorized', () => {
      req.user = { authorized: true };
      const middleware = sessionManager.authenticate();
      middleware(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args).to.be.empty;
    });

    it('should call next with error if user is not authorized', () => {
      req.user = { authorized: false };
      const middleware = sessionManager.authenticate();
      middleware(req, res, next);
      expect(next.calledOnce).to.be.true;
      const error = next.firstCall.args[0];
      expect(error).to.be.instanceOf(CustomError);
      expect(error.code).to.equal(httpCodes.UNAUTHORIZED);
    });

    it('should redirect if redirectUrl is provided', () => {
      req.user = { authorized: false };
      const middleware = sessionManager.authenticate(false, '/login');
      middleware(req, res, next);
      expect(res.redirect.calledWith('/login')).to.be.true;
      expect(next.called).to.be.false;
    });

    it('should allow access in debug mode', () => {
      req.user = null;
      const middleware = sessionManager.authenticate(true);
      middleware(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args).to.be.empty;
    });
  });

  describe('redisManager', () => {
    it('should return null before initialization', () => {
      const manager = sessionManager.redisManager();
      expect(manager).to.be.null;
    });
  });
});
