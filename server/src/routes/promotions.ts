import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getPromotionsHandler,
  postPromotionsHandler,
  patchPromotions_ByIdHandler,
  deletePromotions_ByIdHandler,
  postPromotionsEvaluateHandler,
} from '../controllers/promotions.controller';

export const promotionsRouter = Router();

promotionsRouter.get('/promotions', getPromotionsHandler);
promotionsRouter.post('/promotions', requireAuth, postPromotionsHandler);
promotionsRouter.patch('/promotions/:id', requireAuth, patchPromotions_ByIdHandler);
promotionsRouter.delete('/promotions/:id', requireAuth, deletePromotions_ByIdHandler);
promotionsRouter.post('/promotions/evaluate', postPromotionsEvaluateHandler);
