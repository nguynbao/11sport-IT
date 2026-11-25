import type { ParsedStaffImportRow } from "@/shared/types";

/** Định dạng số nguyên thành chuỗi có dấu chấm phân cách hàng nghìn (VD: 10000 -> "10.000", 0 -> "") */
export function formatMoneyInput(val: number | string | undefined | null): string {
  const digits = String(val ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("vi-VN");
}

/** Chuyển chuỗi có dấu chấm phân cách về số nguyên không âm */
export function parseMoneyInput(raw: string): number {
  const digits = String(raw || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return 0;
  return Number(digits) || 0;
}

export function toIsoDateSlice(val?: string | null): string {
  if (!val) return "";
  return String(val).slice(0, 10);
}

export interface EditableImportRow extends ParsedStaffImportRow {
  selected: boolean;
  usernameInput: string;
}
