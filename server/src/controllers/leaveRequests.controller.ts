import { Request, Response, NextFunction } from 'express';
import {
  createLeaveRequest,
  listLeaveRequests,
  cancelLeaveRequest,
  reviewLeaveRequest,
} from '../services/leaveRequests.service';

export async function createLeaveRequestHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const created = await createLeaveRequest(req.user, req.body);
    res.status(201).json({ data: created, meta: {} });
  } catch (err) {
    next(err);
  }
}

export async function getLeaveRequestsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const list = await listLeaveRequests(req.user, req.query);
    res.json({ data: list, meta: { total: list.length } });
  } catch (err) {
    next(err);
  }
}

export async function deleteLeaveRequestHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await cancelLeaveRequest(req.user, req.params.id);
    res.json({ data: { success: true }, meta: { message: 'Đã hủy đơn' } });
  } catch (err) {
    next(err);
  }
}

export async function patchLeaveRequestHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const updated = await reviewLeaveRequest(req.user, req.params.id, req.body);
    res.json({ data: updated, meta: {} });
  } catch (err) {
    next(err);
  }
}
