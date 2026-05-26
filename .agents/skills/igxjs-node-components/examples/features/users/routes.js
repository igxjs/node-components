import { Router } from 'express';
import {
  FlexRouter,
  httpCodes,
  httpError,
  httpHelper,
} from '@igxjs/node-components';
import { session } from '../../config/session-manager.js';

const userRouter = Router();

userRouter.get('/me', (req, res) => res.json({ user: req.user }));

userRouter.get('/upstream', async (_req, res, next) => {
  try {
    const axios = (await import('axios')).default;
    const r = await axios.get('https://upstream.example.com/data');
    res.json(r.data);
  } catch (e) {
    next(httpHelper.handleAxiosError(e, 'Upstream failed'));
  }
});

userRouter.get('/admin', (req, res, next) => {
  if (!req.user?.attributes?.groups?.includes('admin')) {
    return next(httpError(httpCodes.FORBIDDEN, 'Admin access required'));
  }
  res.json({ secret: 42 });
});

export const routers = [
  new FlexRouter('/users', userRouter, [
    session.authenticate(),
    session.requireUser(),
  ]),
];
