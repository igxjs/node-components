import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import express from 'express';
import { FlexRouter } from '../components/router.js';

describe('FlexRouter', () => {
  let app, router, middleware1, middleware2;

  beforeEach(() => {
    app = express();
    router = express.Router();
    middleware1 = sinon.stub().callsFake((req, res, next) => next());
    middleware2 = sinon.stub().callsFake((req, res, next) => next());
    sinon.spy(app, 'use');
  });

  describe('constructor', () => {
    it('should create FlexRouter with context and router', () => {
      const flexRouter = new FlexRouter('/api', router);
      expect(flexRouter.context).to.equal('/api');
      expect(flexRouter.router).to.equal(router);
      expect(flexRouter.handlers).to.deep.equal([]);
    });

    it('should create FlexRouter with handlers', () => {
      const handlers = [middleware1, middleware2];
      const flexRouter = new FlexRouter('/api', router, handlers);
      expect(flexRouter.handlers).to.deep.equal(handlers);
    });
  });

  describe('mount', () => {
    it('should mount router to app with correct path', () => {
      const flexRouter = new FlexRouter('/users', router);
      flexRouter.mount(app, '/api/v1');
      expect(app.use.calledOnce).to.be.true;
      expect(app.use.firstCall.args[0]).to.equal('/api/v1/users');
    });

    it('should mount router with handlers', () => {
      const handlers = [middleware1, middleware2];
      const flexRouter = new FlexRouter('/protected', router, handlers);
      flexRouter.mount(app, '/api');
      expect(app.use.calledOnce).to.be.true;
      expect(app.use.firstCall.args[0]).to.equal('/api/protected');
      expect(app.use.firstCall.args[1]).to.deep.equal(handlers);
    });
  });
});
