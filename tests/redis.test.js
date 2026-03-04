import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { RedisManager } from '../components/redis.js';

describe('RedisManager', () => {
  let redisManager;
  let consoleStubs;

  beforeEach(() => {
    redisManager = new RedisManager();
    consoleStubs = {
      info: sinon.stub(console, 'info'),
      warn: sinon.stub(console, 'warn'),
      error: sinon.stub(console, 'error')
    };
  });

  afterEach(() => {
    consoleStubs.info.restore();
    consoleStubs.warn.restore();
    consoleStubs.error.restore();
  });

  describe('connect', () => {
    it('should return false if redisUrl is empty', async () => {
      const result = await redisManager.connect('', null);
      expect(result).to.be.false;
    });

    it('should return false if redisUrl is null', async () => {
      const result = await redisManager.connect(null, null);
      expect(result).to.be.false;
    });
  });

  describe('getClient', () => {
    it('should return null when not connected', () => {
      const client = redisManager.getClient();
      expect(client).to.be.null;
    });
  });

  describe('isConnected', () => {
    it('should return false when client is null', async () => {
      const result = await redisManager.isConnected();
      expect(result).to.be.false;
    });
  });
});
