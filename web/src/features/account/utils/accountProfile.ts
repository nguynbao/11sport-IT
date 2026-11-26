export function toIsoDateSlice(val?: string | null): string {
  if (!val) return "";
  return String(val).slice(0, 10);
}

export function getContractLabel(contractType: string): string {
  return contractType === "FULLTIME"
    ? "Chính thức"
    : contractType === "PROBATION"
      ? "Thử việc"
      : contractType === "INTERN"
        ? "Thực tập (Intern)"
        : contractType === "PARTTIME"
          ? "Bán thời gian (cũ)"
          : "Chưa cập nhật";
}

export function formatMoney(val: number): string {
  return new Intl.NumberFormat("vi-VN").format(Number(val || 0));
}
