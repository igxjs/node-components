import { expect } from 'chai';
import sinon from 'sinon';
import { Logger } from '../components/logger.js';

describe('Logger', () => {
  let consoleStubs;

  beforeEach(() => {
    // Stub all console methods
    consoleStubs = {
      debug: sinon.stub(console, 'debug'),
      info: sinon.stub(console, 'info'),
      warn: sinon.stub(console, 'warn'),
      error: sinon.stub(console, 'error'),
      log: sinon.stub(console, 'log'),
    };
  });

  afterEach(() => {
    // Restore all console methods
    Object.values(consoleStubs).forEach(stub => stub.restore());
    // Clear all logger instances after each test
    Logger.clearInstances();
  });

  describe('Constructor', () => {
    it('should create a Logger instance with component name', () => {
      const logger = new Logger('TestComponent');
      expect(logger).to.be.instanceOf(Logger);
    });

    it('should enable logging by default in non-production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const logger = new Logger('TestComponent');
      logger.info('test message');

      expect(consoleStubs.info.called).to.be.true;

      process.env.NODE_ENV = originalEnv;
    });

    it('should disable logging by default in production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const logger = new Logger('TestComponent');
      logger.info('test message');

      expect(consoleStubs.info.called).to.be.false;

      process.env.NODE_ENV = originalEnv;
    });

    it('should respect explicit enableLogging parameter (true)', () => {
      const logger = new Logger('TestComponent', true);
      logger.info('test message');

      expect(consoleStubs.info.called).to.be.true;
    });

    it('should respect explicit enableLogging parameter (false)', () => {
      const logger = new Logger('TestComponent', false);
      logger.info('test message');

      expect(consoleStubs.info.called).to.be.false;
    });
  });

  describe('Singleton Pattern (getInstance)', () => {
    it('should return the same instance for same component name and enableLogging', () => {
      const logger1 = Logger.getInstance('TestComponent', true);
      const logger2 = Logger.getInstance('TestComponent', true);

      expect(logger1).to.equal(logger2);
    });

    it('should return different instances for different component names', () => {
      const logger1 = Logger.getInstance('Component1');
      const logger2 = Logger.getInstance('Component2');

      expect(logger1).to.not.equal(logger2);
    });

    it('should return different instances for different enableLogging values', () => {
      const logger1 = Logger.getInstance('TestComponent', true);
      const logger2 = Logger.getInstance('TestComponent', false);

      expect(logger1).to.not.equal(logger2);
    });

    it('should return same instance when enableLogging is undefined (default)', () => {
      const logger1 = Logger.getInstance('TestComponent');
      const logger2 = Logger.getInstance('TestComponent');

      expect(logger1).to.equal(logger2);
    });
  });

  describe('clearInstances', () => {
    it('should clear all logger instances', () => {
      const logger1 = Logger.getInstance('Component1');

      Logger.clearInstances();

      const logger3 = Logger.getInstance('Component1');
      expect(logger3).to.not.equal(logger1);
    });
  });

  describe('Global Color Control', () => {
    it('should disable colors globally', () => {
      Logger.disableColors();
      const logger = new Logger('TestComponent', true);

      logger.info('test');

      // Check that prefix doesn't contain ANSI color codes
      const callArgs = consoleStubs.info.firstCall.args;
      expect(callArgs[0]).to.not.include('\x1b[');

      Logger.enableColors();
    });

    it('should enable colors globally', () => {
      Logger.enableColors();

      // Note: Colors are only enabled when stdout.isTTY is true
      // In test environment, this is usually false
      const logger = new Logger('TestComponent', true);
      logger.info('test');

      expect(consoleStubs.info.called).to.be.true;
    });
  });

  describe('Logging Methods (Enabled)', () => {
    let logger;

    beforeEach(() => {
      logger = new Logger('TestComponent', true);
    });

    it('should log debug messages', () => {
      logger.debug('debug message', { data: 'test' });

      expect(consoleStubs.debug.called).to.be.true;
      expect(consoleStubs.debug.firstCall.args).to.include('debug message');
    });

    it('should log info messages', () => {
      logger.info('info message', { data: 'test' });

      expect(consoleStubs.info.called).to.be.true;
      expect(consoleStubs.info.firstCall.args).to.include('info message');
    });

    it('should log warn messages', () => {
      logger.warn('warn message', { data: 'test' });

      expect(consoleStubs.warn.called).to.be.true;
      expect(consoleStubs.warn.firstCall.args).to.include('warn message');
    });

    it('should log error messages', () => {
      logger.error('error message', new Error('test error'));

      expect(consoleStubs.error.called).to.be.true;
      expect(consoleStubs.error.firstCall.args).to.include('error message');
    });

    it('should log general messages', () => {
      logger.log('general message');

      expect(consoleStubs.log.called).to.be.true;
      expect(consoleStubs.log.firstCall.args).to.include('general message');
    });

    it('should include component name prefix in logs', () => {
      logger.info('test message');

      const prefix = consoleStubs.info.firstCall.args[0];
      expect(prefix).to.include('[TestComponent]');
    });

    it('should handle multiple arguments', () => {
      logger.info('message', { key: 'value' }, 123, true);

      expect(consoleStubs.info.called).to.be.true;
      expect(consoleStubs.info.firstCall.args.length).to.be.greaterThan(1);
    });
  });

  describe('Logging Methods (Disabled)', () => {
    let logger;

    beforeEach(() => {
      logger = new Logger('TestComponent', false);
    });

    it('should not log debug messages when disabled', () => {
      logger.debug('debug message');

      expect(consoleStubs.debug.called).to.be.false;
    });

    it('should not log info messages when disabled', () => {
      logger.info('info message');

      expect(consoleStubs.info.called).to.be.false;
    });

    it('should not log warn messages when disabled', () => {
      logger.warn('warn message');

      expect(consoleStubs.warn.called).to.be.false;
    });

    it('should not log error messages when disabled', () => {
      logger.error('error message');

      expect(consoleStubs.error.called).to.be.false;
    });

    it('should not log general messages when disabled', () => {
      logger.log('general message');

      expect(consoleStubs.log.called).to.be.false;
    });
  });

  describe('Color Detection', () => {
    it('should respect NO_COLOR environment variable', () => {
      const originalNoColor = process.env.NO_COLOR;
      process.env.NO_COLOR = '1';

      const logger = new Logger('TestComponent', true);
      logger.info('test');

      // Should not have color codes due to NO_COLOR
      const callArgs = consoleStubs.info.firstCall.args;
      expect(callArgs[0]).to.not.include('\x1b[36m'); // cyan color code

      process.env.NO_COLOR = originalNoColor;
    });
  });

  describe('Performance - No-op Functions', () => {
    it('should use no-op functions when logging is disabled for better performance', () => {
      const logger = new Logger('TestComponent', false);

      // These should execute without calling actual console methods
      logger.debug('test');
      logger.info('test');
      logger.warn('test');
      logger.error('test');
      logger.log('test');

      // Verify no console methods were called
      expect(consoleStubs.debug.called).to.be.false;
      expect(consoleStubs.info.called).to.be.false;
      expect(consoleStubs.warn.called).to.be.false;
      expect(consoleStubs.error.called).to.be.false;
      expect(consoleStubs.log.called).to.be.false;
    });
  });
});