import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  postAuthLoginHandler,
  postAuthChangePasswordHandler,
  getStaffHandler,
  postStaffParseImportFileHandler,
  postStaffHandler,
  patchStaff_ByIdHandler,
} from '../controllers/authStaff.controller';

export const authStaffRouter = Router();

authStaffRouter.post('/auth/login', postAuthLoginHandler);
authStaffRouter.post('/auth/change-password', requireAuth, postAuthChangePasswordHandler);
authStaffRouter.use('/staff', requireAuth);
authStaffRouter.get('/staff', getStaffHandler);
authStaffRouter.post('/staff/parse-import-file', postStaffParseImportFileHandler);
authStaffRouter.post('/staff', postStaffHandler);
authStaffRouter.patch('/staff/:id', patchStaff_ByIdHandler);
