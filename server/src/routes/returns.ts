import { Router } from 'express';
import { requireRoles } from '../middleware/auth';
import {
  getReturnsHandler,
  postReturnsCalculateHandler,
  postReturnsHandler,
} from '../controllers/returns.controller';

export const returnsRouter = Router();

returnsRouter.use(
  '/returns',
  requireRoles(
    ['CEO', 'ADMIN', 'SALES', 'ACCOUNTANT'],
    'Chỉ Bán hàng, Kế toán hoặc Quản lý mới có quyền thực hiện trả/đổi hàng'
  )
);

returnsRouter.get('/returns', getReturnsHandler);
returnsRouter.post('/returns/calculate', postReturnsCalculateHandler);
returnsRouter.post('/returns', postReturnsHandler);
