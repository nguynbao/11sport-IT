import { Router } from 'express';
import {
  createLeaveRequestHandler,
  getLeaveRequestsHandler,
  deleteLeaveRequestHandler,
  patchLeaveRequestHandler,
} from '../controllers/leaveRequests.controller';

export const leaveRequestsRouter = Router();

leaveRequestsRouter.post('/leave-requests', createLeaveRequestHandler);
leaveRequestsRouter.get('/leave-requests', getLeaveRequestsHandler);
leaveRequestsRouter.delete('/leave-requests/:id', deleteLeaveRequestHandler);
leaveRequestsRouter.patch('/leave-requests/:id', patchLeaveRequestHandler);
