import { ApiError } from "../../shared/errors";

/** Loại hợp đồng được phép chọn khi tạo/cập nhật: Thực tập, Thử việc, Chính thức */
export const VALID_CONTRACT_TYPES = ['INTERN', 'PROBATION', 'FULLTIME'];



export function parseSalaryField(val: any, fieldLabel: string): number {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${fieldLabel} phải là số không âm`);
  }
  return Math.round(num);
}

export function parseNonNegativeFloat(val: any, fieldLabel: string): number {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${fieldLabel} phải là số không âm`);
  }
  return Number(num.toFixed(2));
}

export function parseOptionalDate(val: any): Date | undefined {
  if (val === undefined || val === null || String(val).trim() === '') return undefined;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function parseNullableDate(val: any): Date | null {
  if (val === null || String(val).trim() === '') return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

// POST /api/v1/staff/parse-import-file

// POST /api/v1/staff

// PATCH /api/v1/staff/:id

