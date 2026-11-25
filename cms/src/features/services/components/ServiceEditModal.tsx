"use client";

import React, { useState, useEffect, useCallback } from "react";
import { StaffUser, ServiceType, ServiceOrder, ServiceOrderStatus, ServicePaymentMethod, ServiceOrdersMeta } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { formatVND, formatNumberDots, parseNumberDots, formatPhone, cleanPhoneDigits } from "@/shared/utils/format";
import { useDebounce } from "@/shared/lib/search";
import {
  Wrench,
  Plus,
  Edit3,
  Trash2,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Clock,
  Wallet,
  PackageCheck,
  Play,
  X,
  Power,
  ListChecks,
  Layers,
} from "lucide-react";
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
import { ServiceManagementViewModel } from "../hooks/useServiceManagement";

export function ServiceEditModal({ vm }: { vm: ServiceManagementViewModel }) {
  const {
    editingOrder,
    setEditingOrder,
    editCustomerName,
    setEditCustomerName,
    editCustomerPhone,
    setEditCustomerPhone,
    editReceivedDate,
    setEditReceivedDate,
    editDueDate,
    setEditDueDate,
    editNote,
    setEditNote,
    editStatus,
    setEditStatus,
    editItems,
    setEditItems,
    savingOrderEdit,
    handleSaveOrderEdit,
  } = vm;

  return (
    <>
      {/* MODAL CHỈNH SỬA ĐƠN DỊCH VỤ */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">
                Chỉnh Sửa Đơn Dịch Vụ — {editingOrder.orderCode}
              </h3>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrderEdit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tên khách hàng *
                  </label>
                  <input
                    type="text"
                    required
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Số điện thoại *
                  </label>
                  <input
                    type="text"
                    required
                    value={editCustomerPhone}
                    onChange={(e) =>
                      setEditCustomerPhone(formatPhone(e.target.value))
                    }
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Ngày gửi *
                  </label>
                  <input
                    type="date"
                    required
                    value={editReceivedDate}
                    onChange={(e) => setEditReceivedDate(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Ngày hẹn trả *
                  </label>
                  <input
                    type="date"
                    required
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Trạng thái
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(e.target.value as ServiceOrderStatus)
                    }
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="RECEIVED">Đã tiếp nhận</option>
                    <option value="IN_PROGRESS">Đang xử lý</option>
                    <option value="READY">Đã xong (Chờ lấy)</option>
                    <option value="RETURNED">Đã trả khách</option>
                    <option value="CANCELLED">Đã hủy</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="block font-bold text-slate-700">
                  Hạng mục dịch vụ & Giá
                </label>
                {editItems.map((it, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                  >
                    <div className="font-bold text-slate-900">
                      #{idx + 1}. {it.serviceName}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-500">
                          Đơn giá (VNĐ)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatNumberDots(it.unitPrice)}
                          onChange={(e) => {
                            const val = parseNumberDots(e.target.value);
                            setEditItems((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, unitPrice: val } : row
                              )
                            );
                          }}
                          className="w-full px-2.5 py-1.5 font-mono font-bold bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500">
                          Số lượng ({it.unit})
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={it.quantity}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value) || 1);
                            setEditItems((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, quantity: val } : row
                              )
                            );
                          }}
                          className="w-full px-2.5 py-1.5 font-mono font-bold bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      value={it.itemNote}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditItems((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, itemNote: val } : row
                          )
                        );
                      }}
                      placeholder="Ghi chú đồ gửi..."
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Ghi chú đơn
                </label>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              {(() => {
                const newTotal = editItems.reduce(
                  (sum, it) =>
                    sum +
                    Math.max(0, Number(it.unitPrice) || 0) *
                      Math.max(1, Number(it.quantity) || 1),
                  0
                );
                const paid = Number(editingOrder.paidAmount) || 0;
                const belowPaid = newTotal < paid;
                return (
                  <div
                    className={`p-2.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
                      belowPaid
                        ? "bg-red-50 border-red-300 text-red-700"
                        : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}
                  >
                    <div>
                      Tổng mới:{" "}
                      <strong className="font-mono">{formatVND(newTotal)}</strong>{" "}
                      • Đã thu:{" "}
                      <strong className="font-mono text-brand-ink">
                        {formatVND(paid)}
                      </strong>
                    </div>
                    {belowPaid && (
                      <span className="font-extrabold text-red-600">
                        ⚠️ Không được giảm tổng thấp hơn số tiền đã thu!
                      </span>
                    )}
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 font-bold text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingOrderEdit}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold"
                >
                  {savingOrderEdit ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
