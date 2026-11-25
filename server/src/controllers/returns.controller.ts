import { handle } from '../shared/http';
import {
  listReturns,
  calculateReturnExchange,
  createReturnExchange,
} from '../services/returns';

export const getReturnsHandler = handle((req) => listReturns(req.query));
export const postReturnsCalculateHandler = handle((req) => calculateReturnExchange(req.body));
export const postReturnsHandler = handle((req, ctx) => createReturnExchange(ctx, req.body));
