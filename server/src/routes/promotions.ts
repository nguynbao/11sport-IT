import { Router } from 'express';
import {
  getPromotionsHandler,
  postPromotionsHandler,
  patchPromotions_ByIdHandler,
  deletePromotions_ByIdHandler,
  postPromotionsEvaluateHandler,
} from '../controllers/promotions.controller';

export const promotionsRouter = Router();

promotionsRouter.get('/promotions', getPromotionsHandler);
promotionsRouter.post('/promotions', postPromotionsHandler);
promotionsRouter.patch('/promotions/:id', patchPromotions_ByIdHandler);
promotionsRouter.delete('/promotions/:id', deletePromotions_ByIdHandler);
promotionsRouter.post('/promotions/evaluate', postPromotionsEvaluateHandler);
