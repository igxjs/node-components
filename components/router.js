/**
 * FlexRouter for expressjs
 * 
 * @example
 * import { Router } from 'express';
 * import { FlexRouter } from '../models/router.js';
 * import { authenticate } from '../middlewares/common.js';
 * 
 * export const publicRouter = Router();
 * export const privateRouter = Router();
 * 
 * publicRouter.get('/health', (req, res) => {
 *  res.send('OK');
 * });
 * 
 * privateRouter.get('/', (req, res) => {
 *  res.send('Hello World!');
 * });
 * 
 * export const routers = [
 *  new FlexRouter('/api/v1/protected', privateRouter, [authenticate]),
 *  new FlexRouter('/api/v1/public', healthRouter),
 * ];
 */
export class FlexRouter {
  /** @type {string} */
  context = '';
  /** @type {import('@types/express').Router} */
  router = null;
  /** @type {import('@types/express').RequestHandler[]} */
  handlers = [];

  /**
   * Constructor
   * @param {string} context Context path
   * @param {import('@types/express').Router} router Router instance
   * @param {import('@types/express').RequestHandler[]} handlers Request handlers
   */
  constructor(context, router, handlers = []) {
    this.context = context;
    this.router = router;
    this.handlers = handlers;
  }

  /**
   * Mount router to Express application
   * @param {import('@types/express').Express} app Express app
   * @param {string} basePath Base path
   * @throws {TypeError} If app is not a valid Express instance
   * @throws {TypeError} If basePath is not a string
   */
  mount(app, basePath) {
    // Validate app is an Express instance (has 'use' method)
    if (!app || typeof app.use !== 'function') {
      throw new TypeError('Invalid Express app: app must be an Express application instance with a "use" method');
    }

    // Validate basePath is a string
    if (typeof basePath !== 'string') {
      throw new TypeError(`Invalid basePath: expected string but received ${typeof basePath}`);
    }

    const path = basePath.concat(this.context);
    app.use(path, this.handlers, this.router);
  }
}
