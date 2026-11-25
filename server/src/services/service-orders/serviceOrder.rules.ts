import type { ServiceOrderStatus, ServicePaymentStatus } from "../../models/ServiceOrder";

export const SERVICE_ORDER_ALLOWED_ROLES = ['CEO', 'ADMIN', 'ACCOUNTANT', 'SALES'];
export const SERVICE_ORDER_MUTATE_ROLES = ['CEO', 'ADMIN', 'SALES'];
export const SERVICE_TYPE_MANAGE_ROLES = ['CEO', 'ADMIN'];


export function normalizeServiceCode(input: string): string {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function parseDateTimeInput(raw: unknown): Date | null {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 18, 0, 0, 0);
  }
  const dt = new Date(str);
  if (isNaN(dt.getTime())) return null;
  return dt;
}


export function enrichServiceOrder(order: any, nowMs = Date.now()) {
  const dueMs = order.dueAt ? new Date(order.dueAt).getTime() : 0;
  const activeStatuses: ServiceOrderStatus[] = ['RECEIVED', 'IN_PROGRESS', 'READY'];
  const isOverdue =
    activeStatuses.includes(order.status) && dueMs > 0 && nowMs > dueMs;
  return {
    ...order,
    isOverdue,
  };
}

export function computePaymentStatus(totalAmount: number, paidAmount: number): ServicePaymentStatus {
  if (totalAmount <= 0 || paidAmount >= totalAmount) return 'PAID';
  if (paidAmount > 0) return 'PARTIAL';
  return 'UNPAID';
}

