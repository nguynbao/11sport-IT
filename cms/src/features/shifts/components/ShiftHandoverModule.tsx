"use client";


import { StaffUser } from "@/shared/types";
import {
AlertTriangle,
ArrowRight,
Boxes,
Calendar,
CheckCircle2,
ClipboardCheck,
Eye,
RefreshCw,
Save,
Search,
Settings,
Shuffle,
Trash2
} from "lucide-react";
import { DEFAULT_WEEKLY_SCHEDULE,shiftLabel,useShiftHandover,WEEKDAY_LABELS } from "../hooks/useShiftHandover";
import { ShiftHandoverDetailModal } from "./ShiftHandoverDetailModal";
import { PaginationBar } from "@/shared/ui/PaginationBar";

export default function ShiftHandoverModule({ currentUser }: { currentUser: StaffUser | null }) {
  const vm = useShiftHandover({ currentUser });
  const {
    isReadOnlySchedule,
    dailyCheck,
    previewDate,
    setPreviewDate,
    loading,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    shiftFilter,
    setShiftFilter,
    statusFilter,
    setStatusFilter,
    onlyDiscrepancy,
    setOnlyDiscrepancy,
    searchTerm,
    setSearchTerm,
    setSelectedHandover,
    setAdminConfirmNote,
    actionLoading,
    notice,
    showScheduleConfig,
    setShowScheduleConfig,
    scheduleConfig,
    availableCategories,
    savingSchedule,
    handleSaveScheduleConfig,
    handleChangeWeekdayCompanion,
    loadHandovers,
    handleDelete,
    filteredItems,
    totalCount,
    pendingCount,
    acceptedCount,
    discrepancyCount,
    renderStatusBadge,
  } = vm;

  return (
    <div className="space-y-6">
      {/* Header & Cấu hình danh mục kiểm cố định theo Thứ trong tuần */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-2xl bg-teal-50 text-brand-ink border border-teal-200">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Quản Lý Phiếu Bàn Giao Ca Bán Hàng (Kho Tầng 1)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kiểm tổng số lượng Tầng 1 theo danh mục cố định từng ngày trong tuần (Vợt + Danh mục đi kèm), chốt tiền mặt két và xác nhận bàn giao ca.
              </p>
            </div>
          </div>

          {/* Box xem nhóm kiểm hàng cố định theo Thứ + Nút cấu hình */}
          <div className="p-3.5 rounded-2xl bg-teal-50/80 border border-teal-200 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Shuffle className="w-4 h-4 text-brand-ink shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-teal-950">Lịch kiểm hàng theo ngày:</div>
                <div className="text-[11px] text-brand-ink">Cố định theo Thứ (Vợt + Nhóm cấu hình)</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={previewDate}
                onChange={(e) => setPreviewDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-white border border-teal-300 text-xs font-bold text-slate-800 outline-none"
              />
              <span className="px-3 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-extrabold shadow-xs">
                {dailyCheck?.checkedCategoryLabel || "Vợt + ..."}
              </span>
              {dailyCheck && (
                <span className="text-xs font-bold text-teal-900 bg-white px-2.5 py-1.5 rounded-xl border border-teal-200">
                  Tổng tồn T1: {dailyCheck.totalExpectedQty ?? 0} SP ({dailyCheck.totalCheckedProducts} mã)
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowScheduleConfig((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                {isReadOnlySchedule ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <Settings className="w-3.5 h-3.5" />
                )}
                <span>
                  {showScheduleConfig
                    ? isReadOnlySchedule
                      ? "Đóng lịch tuần"
                      : "Đóng cấu hình"
                    : isReadOnlySchedule
                    ? "Xem lịch tuần"
                    : "Cấu hình lịch tuần"}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Bảng cấu hình / xem lịch kiểm hàng cố định Thứ 2 -> Chủ Nhật */}
        {showScheduleConfig && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-teal-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  {isReadOnlySchedule ? (
                    <Eye className="w-4 h-4 text-brand-ink" />
                  ) : (
                    <Settings className="w-4 h-4 text-brand-ink" />
                  )}
                  {isReadOnlySchedule
                    ? "Lịch Kiểm Hàng Cố Định Theo Thứ Trong Tuần (Chỉ xem)"
                    : "Cấu Hình Lịch Kiểm Hàng Cố Định Theo Thứ Trong Tuần (Luôn gồm Vợt + Danh mục đi kèm)"}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isReadOnlySchedule
                    ? "Lịch kiểm hàng cố định từng ngày trong tuần (luôn gồm Vợt + Danh mục đi kèm). Kế toán chỉ có quyền xem lịch."
                    : 'Chọn hoặc nhập danh mục kiểm kèm với Vợt cho từng ngày. Có thể nhập nhiều danh mục cách nhau bởi dấu "+" (VD: Vớ + Quấn cán).'}
                </p>
              </div>
              {!isReadOnlySchedule && (
                <button
                  type="button"
                  onClick={handleSaveScheduleConfig}
                  disabled={savingSchedule}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingSchedule ? "Đang lưu..." : "Lưu lịch kiểm tuần"}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
              {WEEKDAY_LABELS.map((day) => {
                const currentCompanions =
                  scheduleConfig[day.key] || DEFAULT_WEEKLY_SCHEDULE[day.key] || ["Giày"];
                const currentText = currentCompanions[0] || "Giày";
                const companionOptions = availableCategories.filter((c) => !c.isPrimary);
                const matchedOption = companionOptions.find(
                  (c) =>
                    c.name.toLowerCase() === currentText.toLowerCase() ||
                    (c.code && c.code.toLowerCase() === currentText.toLowerCase())
                );
                const selectValue = matchedOption ? matchedOption.name : currentText;

                return (
                  <div
                    key={day.key}
                    className="p-3 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between gap-2 shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-900">{day.label}</span>
                        <span className="px-1.5 py-0.5 rounded bg-teal-50 text-brand-ink font-bold text-[10px] border border-teal-200">
                          Vợt + ...
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-brand-ink mt-1 truncate">
                        Vợt + {selectValue}
                      </div>
                    </div>

                    {isReadOnlySchedule ? (
                      <div className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 truncate">
                        {selectValue}
                        {typeof matchedOption?.expectedTotalQty === "number"
                          ? ` (T1: ${matchedOption.expectedTotalQty})`
                          : ""}
                      </div>
                    ) : (
                      <div>
                        <select
                          value={selectValue}
                          onChange={(e) => {
                            if (e.target.value) {
                              handleChangeWeekdayCompanion(day.key, e.target.value);
                            }
                          }}
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                        >
                          {!matchedOption && selectValue && (
                            <option value={selectValue}>{selectValue}</option>
                          )}
                          {companionOptions.map((c) => (
                            <option key={c._id} value={c.name}>
                              {c.name}
                              {typeof c.expectedTotalQty === "number"
                                ? ` (T1: ${c.expectedTotalQty})`
                                : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {notice && (
          <div
            className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
              notice.type === "ok"
                ? "bg-teal-50 text-brand-ink border-teal-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {notice.type === "ok" ? (
              <CheckCircle2 className="w-4 h-4 text-brand-ink shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500 font-semibold">Tổng phiếu bàn giao</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalCount}</div>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
            <div className="text-xs text-amber-800 font-semibold">Chờ Ca 2 xác nhận</div>
            <div className="text-2xl font-black text-amber-900 mt-1">{pendingCount}</div>
          </div>
          <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200">
            <div className="text-xs text-brand-ink font-semibold">Đã xác nhận / Hoàn tất</div>
            <div className="text-2xl font-black text-teal-900 mt-1">{acceptedCount}</div>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200">
            <div className="text-xs text-rose-800 font-semibold">Phiếu có lệch tồn / Báo lệch</div>
            <div className="text-2xl font-black text-rose-900 mt-1">{discrepancyCount}</div>
          </div>
        </div>

        {/* Bộ lọc */}
        <div className="flex flex-wrap items-end gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Từ ngày</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Đến ngày</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Ca bàn giao</label>
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
            >
              <option value="ALL">Tất cả ca</option>
              <option value="SHIFT_1">Ca 1 (08:30 - 17:30)</option>
              <option value="SHIFT_2">Ca 2 (12:00 - 21:00)</option>
              <option value="BOTH">Cả 2 ca (08:30 - 21:00)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Trạng thái</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="DRAFT">Bản nháp trong ca</option>
              <option value="PENDING">Chờ Ca 2 xác nhận</option>
              <option value="ACCEPTED">Đã xác nhận</option>
              <option value="DISCREPANCY_REPORTED">Có báo lệch</option>
              <option value="STORE_CLOSED">Kết ca đóng cửa</option>
            </select>
          </div>

          <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyDiscrepancy}
              onChange={(e) => setOnlyDiscrepancy(e.target.checked)}
              className="rounded text-brand-ink"
            />
            <span>Chỉ hiện phiếu lệch tồn</span>
          </label>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm tên nhân viên, mã sản phẩm, ghi chú..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <button
            type="button"
            onClick={loadHandovers}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Bảng danh sách phiếu bàn giao ca */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[11px]">
                <th className="py-3.5 px-4">Ngày / Ca</th>
                <th className="py-3.5 px-4">Nhân viên bàn giao → Nhận</th>
                <th className="py-3.5 px-4">Nhóm hàng kiểm</th>
                <th className="py-3.5 px-4 text-right">Tiền mặt két</th>
                <th className="py-3.5 px-4">Đối soát Tầng 1</th>
                <th className="py-3.5 px-4">Trạng thái</th>
                <th className="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Đang tải danh sách phiếu bàn giao ca...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Chưa có phiếu bàn giao ca nào trong khoảng thời gian này.
                  </td>
                </tr>
              ) : (
                vm.handoverPagination.items.map((h) => {
                  const diffCount = Array.isArray(h.discrepancies) ? h.discrepancies.length : 0;
                  const categoriesText =
                    Array.isArray(h.checkedCategories) && h.checkedCategories.length > 0
                      ? h.checkedCategories.join(" + ")
                      : "Vợt + Nhóm theo ngày";
                  const categoryCounts = Array.isArray(h.categoryCounts) ? h.categoryCounts : [];

                  return (
                    <tr key={h._id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{h.date}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {shiftLabel(h.shiftCode)}
                        </div>
                        {h.submittedAt && (
                          <div className="text-[10px] font-bold text-brand-ink mt-0.5">
                            Chốt gửi:{" "}
                            {new Date(h.submittedAt).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <span>{h.fromStaffName}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          <span
                            className={
                              h.toStaffName
                                ? "text-brand-ink font-bold"
                                : "text-amber-600 italic font-semibold"
                            }
                          >
                            {h.toStaffName ||
                              (h.status === "DRAFT"
                                ? "Đang lưu nháp trong ca"
                                : h.shiftCode === "SHIFT_1"
                                ? "Chờ Ca 2 nhận"
                                : "Chờ Ca 1 sáng sau nhận")}
                          </span>
                        </div>
                        {h.notes && (
                          <div className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                            Lý do/Ghi chú: {h.notes}
                          </div>
                        )}
                        {h.lateCheckoutReason && (
                          <div className="text-[11px] text-rose-600 font-semibold truncate max-w-xs mt-0.5">
                            Lý do gửi trễ ({h.lateCheckoutMinutes || 0}p): {h.lateCheckoutReason}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-900 border border-teal-200 font-bold text-[11px]">
                          <Boxes className="w-3 h-3 text-brand-ink" />
                          {categoriesText}
                        </span>
                        {categoryCounts.length > 0 ? (
                          <div className="text-[11px] text-slate-600 mt-1 space-y-0.5">
                            {categoryCounts.map((cc, i) => (
                              <div key={i} className="font-semibold">
                                {cc.categoryName}:{" "}
                                <span className="font-mono font-bold text-slate-900">
                                  {cc.actualTotalQty}
                                </span>
                                <span className="text-slate-400 font-mono">
                                  /{cc.expectedTotalQty}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          typeof h.totalCheckedProducts === "number" &&
                          h.totalCheckedProducts > 0 && (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Đã kiểm {h.totalCheckedProducts} mã SP
                            </div>
                          )
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {Number(h.cashBalance || 0).toLocaleString("vi-VN")} đ
                      </td>

                      <td className="py-3.5 px-4">
                        {diffCount === 0 ? (
                          <span className="text-brand-ink font-bold text-xs">
                            Khớp 100% tồn Tầng 1
                          </span>
                        ) : (
                          <div>
                            <span className="text-amber-700 font-extrabold text-xs">
                              Lệch {diffCount} mã sản phẩm
                            </span>
                            <div className="text-[11px] text-slate-500 truncate max-w-[220px]">
                              {h.discrepancies
                                .slice(0, 2)
                                .map((d) => `${d.productCode} (${d.expected}→${d.actual})`)
                                .join(", ")}
                              {diffCount > 2 ? "..." : ""}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">{renderStatusBadge(h)}</td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedHandover(h);
                              setAdminConfirmNote(h.confirmNote || "");
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold inline-flex items-center gap-1 transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Chi tiết</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(h)}
                            disabled={actionLoading}
                            title="Xóa phiếu bàn giao"
                            className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <PaginationBar
            totalItems={vm.handoverPagination.total}
            page={vm.handoverPagination.page}
            totalPages={vm.handoverPagination.totalPages}
            pageSize={vm.handoverPagination.pageSize}
            onPageChange={vm.handoverPagination.setPage}
            onPageSizeChange={vm.handoverPagination.setPageSize}
            itemLabel="phiếu bàn giao"
          />
        </div>
      </div>

      <ShiftHandoverDetailModal vm={vm} />
    </div>
  );
}

