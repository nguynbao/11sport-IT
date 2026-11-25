"use client";

import { ServiceOrderStatus,StaffUser } from "@/shared/types";
import {
AlertCircle,
CheckCircle2,
Layers,
ListChecks,
Wrench,
X
} from "lucide-react";
import { useServiceManagement } from "../hooks/useServiceManagement";
import { ServiceEditModal } from "./ServiceEditModal";
import { ServiceOrdersTab } from "./ServiceOrdersTab";
import { ServicePaymentModal } from "./ServicePaymentModal";
import { ServiceTypesTab } from "./ServiceTypesTab";
const STATUS_INFO: Record<
  ServiceOrderStatus,
  { label: string; badgeCls: string }
> = {
  RECEIVED: {
    label: "Đã tiếp nhận",
    badgeCls: "bg-teal-50 text-brand-ink border-teal-200",
  },
  IN_PROGRESS: {
    label: "Đang xử lý",
    badgeCls: "bg-amber-50 text-amber-800 border-amber-300",
  },
  READY: {
    label: "Đã xong (Chờ lấy)",
    badgeCls: "bg-teal-50 text-brand-ink border-teal-300",
  },
  RETURNED: {
    label: "Đã trả khách",
    badgeCls: "bg-slate-100 text-slate-700 border-slate-300",
  },
  CANCELLED: {
    label: "Đã hủy",
    badgeCls: "bg-red-50 text-red-600 border-red-200",
  },
};

function formatDateDisplay(raw?: string | null): string {
  if (!raw) return "—";
  const dt = new Date(raw);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function toInputDate(raw?: string | null): string {
  if (!raw) return "";
  const dt = new Date(raw);
  if (isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function ServiceManagementModule({ currentUser }: { currentUser?: StaffUser | null }) {
  const vm = useServiceManagement({ currentUser });
  const {
    isAccountantReadOnly,
    canManageServices,
    subTab,
    setSubTab,
    errorMsg,
    setErrorMsg,
    successMsg,
    setSuccessMsg,
    serviceTypes,
    ordersMeta,
  } = vm;

  return (
    <div className="space-y-5">
      {/* HEADER & CHUYỂN TAB */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900">
              {isAccountantReadOnly
                ? "Theo Dõi Đơn Dịch Vụ"
                : "Quản Lý Dịch Vụ & Đơn Dịch Vụ"}
            </h1>
            <p className="text-xs text-slate-500">
              {isAccountantReadOnly
                ? "Tra cứu danh sách đơn dịch vụ, doanh thu dịch vụ và số tiền còn phải thu (Chế độ Kế toán - Chỉ xem)"
                : "Tạo danh mục loại dịch vụ (giá mặc định) và theo dõi toàn bộ đơn dịch vụ khách gửi"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab("ORDERS")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition ${
              subTab === "ORDERS"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <ListChecks className="w-4 h-4" />
            <span>
              {isAccountantReadOnly ? "Danh sách Đơn Dịch Vụ" : "Quản lý Đơn Dịch Vụ"} ({ordersMeta.totalOrders})
            </span>
            {ordersMeta.overdueCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-red-600 text-white">
                {ordersMeta.overdueCount} quá hạn
              </span>
            )}
          </button>

          {canManageServices && (
            <button
              type="button"
              onClick={() => setSubTab("TYPES")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition ${
                subTab === "TYPES"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Danh mục Loại Dịch Vụ ({serviceTypes.length})</span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg("")} className="text-red-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-brand-ink text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg("")} className="text-brand-ink">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ================================================== */}
      <ServiceOrdersTab vm={vm} />
      <ServiceTypesTab vm={vm} />
      <ServicePaymentModal vm={vm} />
      <ServiceEditModal vm={vm} />
    </div>
  );
}
