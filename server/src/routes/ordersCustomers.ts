import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getCustomersLookupHandler,
  getCustomersHandler,
  getOrdersCurrentShiftHandler,
  getOrdersHandler,
  getOrdersByCode_ByCodeHandler,
  getOrders_ByIdHandler,
  postOrdersHandler,
  putOrders_ByIdHandler,
  postOrders_ByIdConfirmHandler,
  postOrders_ByIdDebtPaymentHandler,
  deleteOrders_ByIdHandler,
} from '../controllers/ordersCustomers.controller';

export const ordersCustomersRouter = Router();

ordersCustomersRouter.use(requireAuth);

ordersCustomersRouter.get('/customers/lookup', getCustomersLookupHandler);
ordersCustomersRouter.get('/customers', getCustomersHandler);
ordersCustomersRouter.get('/orders/current-shift', getOrdersCurrentShiftHandler);
ordersCustomersRouter.get('/orders', getOrdersHandler);
ordersCustomersRouter.get('/orders/by-code/:code', getOrdersByCode_ByCodeHandler);
ordersCustomersRouter.get('/orders/:id', getOrders_ByIdHandler);
ordersCustomersRouter.post('/orders', postOrdersHandler);
ordersCustomersRouter.put('/orders/:id', putOrders_ByIdHandler);
ordersCustomersRouter.post('/orders/:id/confirm', postOrders_ByIdConfirmHandler);
ordersCustomersRouter.post('/orders/:id/debt-payment', postOrders_ByIdDebtPaymentHandler);
ordersCustomersRouter.delete('/orders/:id', deleteOrders_ByIdHandler);
