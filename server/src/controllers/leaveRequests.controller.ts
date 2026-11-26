import { handle } from '../shared/http';
import { created, ok } from '../shared/result';
import { withPagination } from '../shared/pagination';
import {
  createLeaveRequest,
  listLeaveRequests,
  cancelLeaveRequest,
  reviewLeaveRequest,
} from '../services/leave';

export const createLeaveRequestHandler = handle(async (req, ctx) => {
  const createdReq = await createLeaveRequest(ctx.user, req.body);
  return created(createdReq);
});

export const getLeaveRequestsHandler = handle(async (req, ctx) => {
  const list = await listLeaveRequests(ctx.user, req.query);
  return withPagination(list, req.query);
});

export const deleteLeaveRequestHandler = handle(async (req, ctx) => {
  await cancelLeaveRequest(ctx.user, req.params.id);
  return ok({ success: true }, { message: 'Đã hủy đơn' });
});

export const patchLeaveRequestHandler = handle(async (req, ctx) => {
  const updated = await reviewLeaveRequest(ctx.user, req.params.id, req.body);
  return ok(updated);
});
