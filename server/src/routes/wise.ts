import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getWiseCurrenciesHandler,
  postWiseQuoteHandler,
} from '../controllers/wise.controller';

export const wiseRouter = Router();

wiseRouter.use('/wise', requireAuth);
wiseRouter.get('/wise/currencies', getWiseCurrenciesHandler);
wiseRouter.post('/wise/quote', postWiseQuoteHandler);
