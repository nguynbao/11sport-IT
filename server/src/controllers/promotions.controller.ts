import { handle } from '../shared/http';
import {
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  evaluatePromotions,
} from '../services/promotions';

export const getPromotionsHandler = handle((req) => listPromotions(req.query));
export const postPromotionsHandler = handle((req, ctx) => createPromotion(ctx, req.body));
export const patchPromotions_ByIdHandler = handle((req, ctx) =>
  updatePromotion(ctx, req.params.id, req.body)
);
export const deletePromotions_ByIdHandler = handle((req, ctx) =>
  deletePromotion(ctx, req.params.id)
);
export const postPromotionsEvaluateHandler = handle((req) => evaluatePromotions(req.body));
