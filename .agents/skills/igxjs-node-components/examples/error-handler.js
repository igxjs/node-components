// Wiring httpErrorHandler / httpNotFoundHandler with route-level usage of
// httpError, CustomError, and the helpers (handleAxiosError, toZodMessage).

import express from 'express';
import axios from 'axios';
// Install zod separately if you copy the validation example:
// npm install zod
import { z } from 'zod';
import {
  httpCodes,
  httpError,
  httpErrorHandler,
  httpNotFoundHandler,
  httpHelper,
  CustomError,
} from '@igxjs/node-components';

const app = express();
app.use(express.json());

// 1. Throw a CustomError directly
app.get('/api/items/:id', async (req, res, next) => {
  try {
    const item = await loadItem(req.params.id);
    if (!item) {
      throw httpError(httpCodes.NOT_FOUND, `Item ${req.params.id} not found`);
    }
    res.json(item);
  } catch (e) {
    next(e);
  }
});

// 2. Convert Zod validation errors into 400s with a friendly message
const CreateItem = z.object({
  name:  z.string().min(1),
  price: z.number().positive(),
});

app.post('/api/items', (req, res, next) => {
  try {
    const data = CreateItem.parse(req.body);
    res.status(httpCodes.CREATED).json(data);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return next(httpError(httpCodes.BAD_REQUEST, httpHelper.toZodMessage(e), e));
    }
    next(e);
  }
});

// 3. Convert Axios upstream errors into CustomError, preserving the upstream code
app.get('/api/upstream', async (_req, res, next) => {
  try {
    const r = await axios.get('https://upstream.example.com/data', { timeout: 5000 });
    res.json(r.data);
  } catch (e) {
    next(httpHelper.handleAxiosError(e, 'Upstream service unavailable'));
  }
});

// 4. Throwing CustomError from non-route code propagates fine
async function loadItem(id) {
  if (id === 'forbidden') {
    throw new CustomError(httpCodes.FORBIDDEN, 'Access denied', null, { id });
  }
  return null;
}

// Order matters: 404 first, then error handler last.
app.use(httpNotFoundHandler);
app.use(httpErrorHandler);

app.listen(3000);

// Response shape produced by httpErrorHandler:
// {
//   "status": 404,
//   "message": "Item abc not found"
// }
