import { handle } from '../shared/http';
import {
  listServiceTypes,
  createServiceType,
  updateServiceType,
  deleteServiceType,
  listServiceOrders,
  getServiceOrderById,
  createServiceOrder,
  updateServiceOrder,
  updateServiceOrderStatus,
  recordServiceOrderPayment,
} from '../services/service-orders';

export const getServiceTypesHandler = handle((req, ctx) => listServiceTypes(ctx, req.query));
export const postServiceTypesHandler = handle((req, ctx) => createServiceType(ctx, req.body));
export const patchServiceTypes_ByIdHandler = handle((req, ctx) =>
  updateServiceType(ctx, req.params.id, req.body)
);
export const deleteServiceTypes_ByIdHandler = handle((req, ctx) =>
  deleteServiceType(ctx, req.params.id)
);
export const getServiceOrdersHandler = handle((req, ctx) => listServiceOrders(ctx, req.query));
export const getServiceOrders_ByIdHandler = handle((req, ctx) =>
  getServiceOrderById(ctx, req.params.id)
);
export const postServiceOrdersHandler = handle((req, ctx) => createServiceOrder(ctx, req.body));
export const patchServiceOrders_ByIdHandler = handle((req, ctx) =>
  updateServiceOrder(ctx, req.params.id, req.body)
);
export const patchServiceOrders_ByIdStatusHandler = handle((req, ctx) =>
  updateServiceOrderStatus(ctx, req.params.id, req.body)
);
export const postServiceOrders_ByIdPaymentsHandler = handle((req, ctx) =>
  recordServiceOrderPayment(ctx, req.params.id, req.body)
);
