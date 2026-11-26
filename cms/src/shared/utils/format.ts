import type { ContractType } from "@/shared/types";

export const CONTRACT_TYPE_OPTIONS: { value: ContractType; label: string; desc: string }[] = [
  { value: "INTERN", label: "Thực tập (Intern)", desc: "Không có ngày phép có lương" },
  { value: "PROBATION", label: "Thử việc", desc: "Tích lũy 1 ngày phép/tháng thử việc (cộng khi lên Chính thức)" },
  { value: "FULLTIME", label: "Chính thức", desc: "Cộng phép thử việc (1-2 ngày) + 1 ngày phép/tháng chính thức (cộng dồn)" },
];

export function contractTypeLabel(t?: string | null): string {
  if (t === "FULLTIME") return "Chính thức";
  if (t === "PROBATION") return "Thử việc";
  if (t === "INTERN") return "Thực tập";
  if (t === "PARTTIME") return "Bán thời gian (cũ)";
  return "Chưa cập nhật";
}


export function formatVariantLabel(color?: string, size?: string): string {
  const c = String(color || "").trim();
  const s = String(size || "").trim().toUpperCase();
  if (c && s) return `${c} - Size ${s}`;
  if (c) return `Màu ${c}`;
  if (s) return `Size ${s}`;
  return "";
}

export function formatNumberDots(amount: number | undefined | null): string {
  const num = Math.max(0, Math.round(Number(amount || 0)));
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function parseNumberDots(raw: string): number {
  const digits = String(raw || "").replace(/[^\d]/g, "");
  return digits ? Math.max(0, Math.round(Number(digits) || 0)) : 0;
}

export function cleanPhoneDigits(raw: string | undefined | null): string {
  return String(raw || "").replace(/\D/g, "").slice(0, 11);
}

export function formatPhone(raw: string | undefined | null): string {
  const digits = cleanPhoneDigits(raw);
  if (!digits) return "";
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

export function formatVND(amount: number | undefined | null): string {
  const num = Math.round(Number(amount || 0));
  const sign = num < 0 ? "-" : "";
  const formatted = Math.abs(num)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${formatted} VND`;
}

export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return dateStr;
  }
}

