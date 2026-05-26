import { Router } from 'express';
import { FlexRouter } from '@igxjs/node-components';

const publicRouter = Router();
publicRouter.get('/health', (_req, res) => res.json({ ok: true }));

export const routers = [
  new FlexRouter('/public', publicRouter),
];
