/**
 * Quy tắc phân quyền nghiệp vụ Đổi / Trả hàng (Return & Exchange Rules).
 */

export const RETURN_ALLOWED_ROLES = new Set(['CEO', 'ADMIN', 'ACCOUNTANT']);
export const EXCHANGE_DOWNGRADE_OVERRIDE_ROLES = new Set(['CEO', 'ADMIN']);

export function canProcessReturnOnly(role?: string): boolean {
  return RETURN_ALLOWED_ROLES.has(String(role || '').toUpperCase());
}

export function canOverrideExchangeDowngrade(role?: string): boolean {
  return EXCHANGE_DOWNGRADE_OVERRIDE_ROLES.has(String(role || '').toUpperCase());
}
