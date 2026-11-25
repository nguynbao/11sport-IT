import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getServiceTypesHandler,
  postServiceTypesHandler,
  patchServiceTypes_ByIdHandler,
  deleteServiceTypes_ByIdHandler,
  getServiceOrdersHandler,
  getServiceOrders_ByIdHandler,
  postServiceOrdersHandler,
  patchServiceOrders_ByIdHandler,
  patchServiceOrders_ByIdStatusHandler,
  postServiceOrders_ByIdPaymentsHandler,
} from '../controllers/services.controller';

export const servicesRouter = Router();

servicesRouter.use(requireAuth);

servicesRouter.get('/service-types', getServiceTypesHandler);
servicesRouter.post('/service-types', postServiceTypesHandler);
servicesRouter.patch('/service-types/:id', patchServiceTypes_ByIdHandler);
servicesRouter.delete('/service-types/:id', deleteServiceTypes_ByIdHandler);
servicesRouter.get('/service-orders', getServiceOrdersHandler);
servicesRouter.get('/service-orders/:id', getServiceOrders_ByIdHandler);
servicesRouter.post('/service-orders', postServiceOrdersHandler);
servicesRouter.patch('/service-orders/:id', patchServiceOrders_ByIdHandler);
servicesRouter.patch('/service-orders/:id/status', patchServiceOrders_ByIdStatusHandler);
servicesRouter.post('/service-orders/:id/payments', postServiceOrders_ByIdPaymentsHandler);
