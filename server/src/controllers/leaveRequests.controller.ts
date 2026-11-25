import { handle } from '../shared/http';
import { created, ok } from '../shared/result';
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
  return ok(list, { total: list.length });
});

export const deleteLeaveRequestHandler = handle(async (req, ctx) => {
  await cancelLeaveRequest(ctx.user, req.params.id);
  return ok({ success: true }, { message: 'Đã hủy đơn' });
});

export const patchLeaveRequestHandler = handle(async (req, ctx) => {
  const updated = await reviewLeaveRequest(ctx.user, req.params.id, req.body);
  return ok(updated);
});
