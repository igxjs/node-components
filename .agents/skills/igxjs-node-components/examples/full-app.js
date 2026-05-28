// End-to-end integration entry: SessionManager (TOKEN mode) + feature-exported
// FlexRouter arrays + httpErrorHandler + Logger.

import express from 'express';
import {
  Logger,
  httpErrorHandler,
  httpNotFoundHandler,
} from '@igxjs/node-components';
import { session } from './config/session-manager.js';
import { routers } from './routes.js';

const logger = Logger.getInstance('App');

const app = express();
app.use(express.json());

await session.setup(app);

// Auth endpoints
// Providers and refresh can receive ?app_id=tenant-a to override SSO_APP_ID for that request.
// Start login by redirecting the browser/client to the selected provider.url returned here.
app.get('/auth/providers', session.identityProviders());
app.get('/auth/callback',  session.callback((u) => u));
app.post('/auth/refresh',  session.authenticate(), session.refresh((u) => u));
app.post('/auth/logout',   session.authenticate(), session.requireUser(), session.logout());

// Feature modules own their FlexRouter definitions; app.js only mounts them.
for (const router of routers) {
  router.mount(app, '/api/v1');
}

// Error handlers must be last.
app.use(httpNotFoundHandler);
app.use(httpErrorHandler);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => logger.info('listening on', port));
