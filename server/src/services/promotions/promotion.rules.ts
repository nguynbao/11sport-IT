import type { PromotionStatus } from "../../models/Promotion";
import { ApiError } from "../../shared/errors";

export type EffectivePromotionStatus =
  | 'RUNNING_PERMANENT'
  | 'RUNNING'
  | 'UPCOMING'
  | 'EXPIRED'
  | 'PAUSED';

export function parsePromotionDate(raw: any, isEndOfDayIfDateOnly = false): Date | null {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;
  if (isEndOfDayIfDateOnly && /^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(`${str}T23:59:59.999`);
    return isNaN(d.getTime()) ? null : d;
  }
  if (!isEndOfDayIfDateOnly && /^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(`${str}T00:00:00.000`);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function computePromotionEffectiveState(
  promo: any,
  now: Date = new Date()
): {
  isCurrentlyActive: boolean;
  effectiveStatus: EffectivePromotionStatus;
} {
  if (promo.status !== 'ACTIVE') {
    return { isCurrentlyActive: false, effectiveStatus: 'PAUSED' };
  }
  if (promo.isPermanent) {
    return { isCurrentlyActive: true, effectiveStatus: 'RUNNING_PERMANENT' };
  }
  const start = promo.startDate ? new Date(promo.startDate) : null;
  const end = promo.endDate ? new Date(promo.endDate) : null;

  if (start && !isNaN(start.getTime()) && now.getTime() < start.getTime()) {
    return { isCurrentlyActive: false, effectiveStatus: 'UPCOMING' };
  }
  if (end && !isNaN(end.getTime()) && now.getTime() > end.getTime()) {
    return { isCurrentlyActive: false, effectiveStatus: 'EXPIRED' };
  }
  return { isCurrentlyActive: true, effectiveStatus: 'RUNNING' };
}

export function assertAdminRole(ctx: any) {
  if (!['ADMIN', 'CEO'].includes(ctx.user?.role || '')) {
    throw new ApiError(
      403,
      'PROMOTION_FORBIDDEN',
      'Chỉ Giám đốc (CEO) hoặc Quản lý (ADMIN) mới có quyền tạo, chỉnh sửa hoặc xóa Chương trình khuyến mãi'
    );
  }
}

