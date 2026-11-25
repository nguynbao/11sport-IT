export const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Tiền mặt",
  BANKING: "Chuyển khoản",
  CARD: "Thẻ",
  OTHER: "Khác",
};

export const ROLE_LABELS: Record<string, string> = {
  SALES: "Nhân viên bán hàng",
  ACCOUNTANT: "Kế toán & Kho",
  HR: "Nhân sự (HR)",
  MARKETING: "Marketing",
  ADMIN: "Quản lý",
  CEO: "Giám đốc (CEO)",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Bản nháp",
  PAID: "Đã bán",
  PARTIALLY_RETURNED: "Trả 1 phần",
  FULLY_RETURNED: "Trả toàn bộ",
};
