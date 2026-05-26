import { routers as publicRouters } from './features/public/routes.js';
import { routers as userRouters } from './features/users/routes.js';

export const routers = [
  ...publicRouters,
  ...userRouters,
];
