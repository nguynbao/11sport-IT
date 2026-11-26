import { handle } from '../shared/http';
import {
  lookupCustomer,
  listCustomers,
  getCurrentShiftOrders,
  listOrders,
  getOrderByCode,
  getOrderById,
  createOrder,
  updateDraftOrder,
  confirmDraftOrder,
  payOrderDebt,
  deleteDraftOrder,
} from '../services/orders';

export const getCustomersLookupHandler = handle((req) => lookupCustomer(req.query));
export const getCustomersHandler = handle((req) => listCustomers(req.query));
export const getOrdersCurrentShiftHandler = handle((req, ctx) =>
  getCurrentShiftOrders(ctx, req.query)
);
export const getOrdersHandler = handle((req, ctx) => listOrders(ctx, req.query));
export const getOrdersByCode_ByCodeHandler = handle((req, ctx) =>
  getOrderByCode(ctx, req.params.code)
);
export const getOrders_ByIdHandler = handle((req, ctx) => getOrderById(ctx, req.params.id));
export const postOrdersHandler = handle((req, ctx) => createOrder(ctx, req.body));
export const putOrders_ByIdHandler = handle((req, ctx) =>
  updateDraftOrder(ctx, req.params.id, req.body)
);
export const postOrders_ByIdConfirmHandler = handle((req, ctx) =>
  confirmDraftOrder(ctx, req.params.id, req.body)
);
export const postOrders_ByIdDebtPaymentHandler = handle((req, ctx) =>
  payOrderDebt(ctx, req.params.id, req.body)
);
export const deleteOrders_ByIdHandler = handle((req, ctx) =>
  deleteDraftOrder(ctx, req.params.id)
);
