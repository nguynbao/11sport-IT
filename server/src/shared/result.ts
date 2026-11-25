export interface ServiceResult<T = any> {
  status?: number;
  data?: T;
  meta?: Record<string, any>;
  headers?: Record<string, string>;
  /** Dùng cho các endpoint trả payload đặc thù (VD: printers có success/message ngoài data) */
  rawPayload?: any;
}

export function ok<T>(data: T, meta: Record<string, any> = {}, headers?: Record<string, string>): ServiceResult<T> {
  return { status: 200, data, meta, ...(headers ? { headers } : {}) };
}

export function created<T>(data: T, meta: Record<string, any> = {}, headers?: Record<string, string>): ServiceResult<T> {
  return { status: 201, data, meta, ...(headers ? { headers } : {}) };
}

export function raw(payload: any, status = 200, headers?: Record<string, string>): ServiceResult {
  return { status, rawPayload: payload, ...(headers ? { headers } : {}) };
}
