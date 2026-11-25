"use client";


import {
Boxes,
CheckCircle2,
Coins,
Trash2,
X
} from "lucide-react";
import { ShiftHandoverViewModel,shiftLabel } from "../hooks/useShiftHandover";

export function ShiftHandoverDetailModal({ vm }: { vm: ShiftHandoverViewModel }) {
  const {
    selectedHandover,
    setSelectedHandover,
    adminConfirmNote,
    setAdminConfirmNote,
    actionLoading,
    handleConfirm,
    handleDelete,
    renderStatusBadge,
  } = vm;

  return (
    <>
      {/* Modal Xem Chi Tiết & Duyệt Phiếu Bàn Giao */}
      {selectedHandover && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="bg-teal-600 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base">
                  Chi Tiết Phiếu Bàn Giao Ca ({selectedHandover.date})
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  {shiftLabel(selectedHandover.shiftCode)} • Lập bởi{" "}
                  <b className="text-teal-400">{selectedHandover.fromStaffName}</b>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHandover(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-teal-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                  <div className="text-amber-800 font-bold flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-600" />
                    <span>Tiền mặt bàn giao</span>
                  </div>
                  <div className="font-mono text-base font-black text-amber-950 mt-1">
                    {Number(selectedHandover.cashBalance || 0).toLocaleString("vi-VN")} đ
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200">
                  <div className="text-brand-ink font-bold flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-brand-ink" />
                    <span>Nhóm hàng kiểm theo ngày</span>
                  </div>
                  <div className="font-extrabold text-sm text-teal-950 mt-1">
                    {Array.isArray(selectedHandover.checkedCategories) &&
                    selectedHandover.checkedCategories.length > 0
                      ? selectedHandover.checkedCategories.join(" + ")
                      : "Vợt + Nhóm ngẫu nhiên"}
                  </div>
                  {typeof selectedHandover.totalCheckedProducts === "number" &&
                    selectedHandover.totalCheckedProducts > 0 && (
                      <div className="text-[11px] text-brand-ink">
                        Tổng {selectedHandover.totalCheckedProducts} mã kiểm
                      </div>
                    )}
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-600 font-bold">Người nhận bàn giao</div>
                  <div className="font-extrabold text-sm text-slate-900 mt-1">
                    {selectedHandover.toStaffName ||
                      (selectedHandover.shiftCode === "SHIFT_1"
                        ? "Chưa xác nhận (Chờ Ca 2)"
                        : "Ca đóng cửa (Không có ca sau)")}
                  </div>
                  <div className="mt-1">{renderStatusBadge(selectedHandover)}</div>
                </div>
              </div>

              {selectedHandover.submittedAt && (
                <div className="p-3 rounded-2xl bg-teal-50/70 border border-teal-200 flex items-center justify-between">
                  <span className="font-bold text-teal-900">
                    Mốc thời gian chốt gửi bàn giao (tính giờ Check-out cho người giao ca):
                  </span>
                  <span className="font-mono font-extrabold text-brand-ink">
                    {new Date(selectedHandover.submittedAt).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
              )}

              {selectedHandover.notes && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-700">Lý do / Ghi chú từ người giao ca: </span>
                  <span className="text-slate-900">{selectedHandover.notes}</span>
                </div>
              )}

              {selectedHandover.lateCheckoutReason && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200">
                  <span className="font-bold text-rose-800">
                    Lý do gửi bàn giao / Check-out trễ ({selectedHandover.lateCheckoutMinutes || 0} phút):{" "}
                  </span>
                  <span className="text-rose-950 font-semibold">{selectedHandover.lateCheckoutReason}</span>
                </div>
              )}

              {selectedHandover.confirmNote && (
                <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200">
                  <span className="font-bold text-brand-ink">Ghi chú xác nhận nhận ca: </span>
                  <span className="text-teal-950">{selectedHandover.confirmNote}</span>
                </div>
              )}

              {/* Bảng tổng số lượng theo danh mục kiểm trong ngày */}
              {Array.isArray(selectedHandover.categoryCounts) &&
                selectedHandover.categoryCounts.length > 0 && (
                  <div className="space-y-2">
                    <div className="font-extrabold text-slate-900 text-sm">
                      Tổng số lượng kiểm theo danh mục Tầng 1 (bao gồm mọi size, màu, mã)
                    </div>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-bold">
                            <th className="py-2.5 px-3">Danh mục kiểm</th>
                            <th className="py-2.5 px-3 text-right">Tổng tồn Tầng 1</th>
                            <th className="py-2.5 px-3 text-right">Thực đếm tổng</th>
                            <th className="py-2.5 px-3 text-right">Chênh lệch</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedHandover.categoryCounts.map((cc, idx) => {
                            const diff = cc.actualTotalQty - cc.expectedTotalQty;
                            return (
                              <tr key={idx} className={diff !== 0 ? "bg-amber-50/40" : ""}>
                                <td className="py-2.5 px-3 font-extrabold text-slate-900">
                                  {cc.categoryName}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                                  {cc.expectedTotalQty}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                                  {cc.actualTotalQty}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold">
                                  {diff === 0 ? (
                                    <span className="text-brand-ink">Khớp (0)</span>
                                  ) : (
                                    <span className="text-amber-800">
                                      {diff > 0 ? `+${diff}` : diff}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {/* Danh sách sản phẩm chênh lệch */}
              <div className="space-y-2">
                <div className="font-extrabold text-slate-900 text-sm">
                  Chi tiết chênh lệch tồn Kho Tầng 1 (
                  {Array.isArray(selectedHandover.discrepancies)
                    ? selectedHandover.discrepancies.length
                    : 0}{" "}
                  mã)
                </div>

                {!Array.isArray(selectedHandover.discrepancies) ||
                selectedHandover.discrepancies.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200 text-brand-ink font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-ink" />
                    <span>Tất cả sản phẩm thuộc nhóm kiểm trong ngày đều khớp 100% tồn hệ thống.</span>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold">
                          <th className="py-2.5 px-3">Mã SP</th>
                          <th className="py-2.5 px-3">Tên sản phẩm</th>
                          <th className="py-2.5 px-3">Danh mục</th>
                          <th className="py-2.5 px-3 text-right">Tồn HT</th>
                          <th className="py-2.5 px-3 text-right">Thực đếm</th>
                          <th className="py-2.5 px-3">Ghi chú lệch</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedHandover.discrepancies.map((d, idx) => (
                          <tr key={idx} className="bg-amber-50/30">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                              {d.productCode}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {d.productName || d.productCode}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {d.categoryName || "—"}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">{d.expected}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800">
                              {d.actual}
                            </td>
                            <td className="py-2.5 px-3 text-amber-900">{d.note || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Admin / Quản lý xác nhận hộ hoặc ghi chú xử lý */}
              {selectedHandover.status === "DRAFT" ? (
                <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs">
                  Phiếu này đang ở trạng thái <b>Bản nháp trong ca (DRAFT)</b> — nhân viên chưa bấm xác nhận gửi bàn giao ra ca nên chưa thể xác nhận hoàn tất chấm công.
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <label className="block font-bold text-slate-700">
                    Ghi chú xác nhận / đối soát của Quản lý (Admin / Kế toán)
                  </label>
                  <input
                    type="text"
                    value={adminConfirmNote}
                    onChange={(e) => setAdminConfirmNote(e.target.value)}
                    placeholder="Nhập ghi chú xác nhận hoặc xử lý chênh lệch..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleConfirm(selectedHandover, false)}
                      className="px-3.5 py-2 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs transition cursor-pointer"
                    >
                      Đánh dấu Báo lệch
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleConfirm(selectedHandover, true)}
                      className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs shadow-sm transition cursor-pointer"
                    >
                      ✓ Xác nhận khớp bàn giao
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDelete(selectedHandover)}
                disabled={actionLoading}
                className="px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa phiếu này</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedHandover(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
