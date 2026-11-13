"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Category,
  ShiftHandoverRecord,
  DailyHandoverCheckData,
  HandoverScheduleConfigData,
  apiRequest,
  fetchShiftHandoversApi,
  fetchDailyHandoverCheckApi,
  fetchHandoverScheduleConfigApi,
  updateHandoverScheduleConfigApi,
  confirmShiftHandoverApi,
  deleteShiftHandoverApi,
} from "@/lib/api";
import {
  ClipboardCheck,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Coins,
  Boxes,
  Shuffle,
  Eye,
  Trash2,
  X,
  Calendar,
  ArrowRight,
  Settings,
  Save,
  FileEdit,
} from "lucide-react";

const WEEKDAY_LABELS: Array<{ key: string; label: string; short: string }> = [
  { key: "1", label: "Thứ 2", short: "T2" },
  { key: "2", label: "Thứ 3", short: "T3" },
  { key: "3", label: "Thứ 4", short: "T4" },
  { key: "4", label: "Thứ 5", short: "T5" },
  { key: "5", label: "Thứ 6", short: "T6" },
  { key: "6", label: "Thứ 7", short: "T7" },
  { key: "0", label: "Chủ Nhật", short: "CN" },
];

const DEFAULT_WEEKLY_SCHEDULE: Record<string, string[]> = {
  "1": ["Giày"],
  "2": ["Áo"],
  "3": ["Quần"],
  "4": ["Balo"],
  "5": ["Túi"],
  "6": ["Phụ kiện"],
  "0": ["Bóng"],
};

function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonthStartStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function shiftLabel(code: string) {
  if (code === "SHIFT_1") return "Ca 1 (08:30 - 17:30)";
  if (code === "SHIFT_2") return "Ca 2 (12:00 - 21:00)";
  if (code === "BOTH") return "Cả 2 ca (08:30 - 21:00)";
  return code;
}

export default function ShiftHandoverModule() {
  const [handovers, setHandovers] = useState<ShiftHandoverRecord[]>([]);
  const [dailyCheck, setDailyCheck] = useState<DailyHandoverCheckData | null>(null);
  const [previewDate, setPreviewDate] = useState<string>(() => localDateStr());
  const [loading, setLoading] = useState(false);

  // Filters
  const [fromDate, setFromDate] = useState<string>(() => getMonthStartStr());
  const [toDate, setToDate] = useState<string>(() => localDateStr());
  const [shiftFilter, setShiftFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [onlyDiscrepancy, setOnlyDiscrepancy] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Detail modal
  const [selectedHandover, setSelectedHandover] = useState<ShiftHandoverRecord | null>(null);
  const [adminConfirmNote, setAdminConfirmNote] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Cấu hình lịch kiểm hàng cố định theo Thứ trong tuần (Thứ 2 -> Chủ Nhật: Vợt + ...)
  const [showScheduleConfig, setShowScheduleConfig] = useState<boolean>(false);
  const [scheduleConfig, setScheduleConfig] = useState<Record<string, string[]>>(
    DEFAULT_WEEKLY_SCHEDULE
  );
  const [availableCategories, setAvailableCategories] = useState<
    HandoverScheduleConfigData["availableCategories"]
  >([]);
  const [savingSchedule, setSavingSchedule] = useState<boolean>(false);

  const showNotice = (type: "ok" | "err", text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4000);
  };

  const loadScheduleConfig = useCallback(async () => {
    try {
      const [cfg, catRes] = await Promise.all([
        fetchHandoverScheduleConfigApi().catch(() => null),
        apiRequest<Category[]>("/categories").catch(() => null),
      ]);
      const allCats = Array.isArray(catRes?.data) ? catRes.data : [];

      const mergedMap = new Map<
        string,
        HandoverScheduleConfigData["availableCategories"][number]
      >();

      if (Array.isArray(cfg?.availableCategories)) {
        for (const c of cfg.availableCategories) {
          if (c?.name && !/^(vợt|vot)$/i.test(c.name.trim())) {
            mergedMap.set(c.name.trim().toLowerCase(), {
              _id: String(c._id || c.code || c.name),
              code: c.code,
              name: c.name.trim(),
              productCount: c.productCount,
              expectedTotalQty: c.expectedTotalQty,
              isPrimary: false,
            });
          }
        }
      }

      if (Array.isArray(allCats)) {
        for (const c of allCats) {
          if (
            c?.name &&
            c.status !== "INACTIVE" &&
            !/^(vợt|vot)$/i.test(c.name.trim()) &&
            !/^(vợt|vot)$/i.test(String(c.code || "").trim())
          ) {
            const key = c.name.trim().toLowerCase();
            if (!mergedMap.has(key)) {
              mergedMap.set(key, {
                _id: String(c._id || c.code || c.name),
                code: c.code,
                name: c.name.trim(),
                isPrimary: false,
              });
            }
          }
        }
      }

      if (mergedMap.size === 0) {
        for (const fallbackName of [
          "Giày",
          "Áo",
          "Quần",
          "Quần áo",
          "Bóng thi đấu",
          "Balo",
          "Túi",
          "Phụ kiện",
        ]) {
          mergedMap.set(fallbackName.toLowerCase(), {
            _id: fallbackName,
            code: fallbackName.toUpperCase(),
            name: fallbackName,
            isPrimary: false,
          });
        }
      }

      const finalCategories = Array.from(mergedMap.values());
      setAvailableCategories(finalCategories);

      if (cfg?.weeklySchedule) {
        const normalizedSchedule: Record<string, string[]> = { ...DEFAULT_WEEKLY_SCHEDULE };
        for (const [wd, list] of Object.entries(cfg.weeklySchedule)) {
          if (Array.isArray(list) && list.length > 0) {
            normalizedSchedule[wd] = list.map((raw) => {
              const token = String(raw || "").trim();
              const matched = finalCategories.find(
                (c) =>
                  c.name.toLowerCase() === token.toLowerCase() ||
                  (c.code && c.code.toLowerCase() === token.toLowerCase()) ||
                  String(c._id) === token
              );
              return matched ? matched.name : token;
            });
          }
        }
        setScheduleConfig(normalizedSchedule);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSaveScheduleConfig = async () => {
    if (savingSchedule) return;
    setSavingSchedule(true);
    try {
      const res = await updateHandoverScheduleConfigApi(scheduleConfig);
      if (res.weeklySchedule) {
        setScheduleConfig({ ...DEFAULT_WEEKLY_SCHEDULE, ...res.weeklySchedule });
      }
      showNotice("ok", res.message || "Đã lưu cấu hình lịch kiểm hàng cố định theo tuần!");
      setShowScheduleConfig(false);
      await loadDailyPreview(previewDate);
    } catch (err: any) {
      showNotice("err", err?.message || "Không thể lưu cấu hình lịch kiểm hàng");
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleChangeWeekdayCompanion = (weekdayKey: string, value: string) => {
    const tokens = value
      .split("+")
      .map((s) => s.trim())
      .filter((s) => s && !/^(vợt|vot)$/i.test(s));
    setScheduleConfig((prev) => ({
      ...prev,
      [weekdayKey]: tokens.length > 0 ? tokens : [value.trim() || "Giày"],
    }));
  };

  const loadHandovers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchShiftHandoversApi({
        from: fromDate || undefined,
        to: toDate || undefined,
        shiftCode: shiftFilter,
        status: statusFilter,
        hasDiscrepancy: onlyDiscrepancy,
      });
      setHandovers(Array.isArray(res.items) ? res.items : []);
    } catch (err: any) {
      showNotice("err", err?.message || "Không thể tải danh sách phiếu bàn giao ca");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, shiftFilter, statusFilter, onlyDiscrepancy]);

  const loadDailyPreview = useCallback(async (targetDate: string) => {
    try {
      const data = await fetchDailyHandoverCheckApi(targetDate);
      setDailyCheck(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadHandovers();
  }, [loadHandovers]);

  useEffect(() => {
    loadScheduleConfig();
  }, [loadScheduleConfig]);

  useEffect(() => {
    loadDailyPreview(previewDate);
  }, [previewDate, loadDailyPreview]);

  const handleConfirm = async (record: ShiftHandoverRecord, accept: boolean) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await confirmShiftHandoverApi(
        record._id,
        accept,
        adminConfirmNote.trim() || undefined
      );
      showNotice("ok", res.message || "Đã cập nhật trạng thái phiếu bàn giao ca!");
      setAdminConfirmNote("");
      setSelectedHandover(res.handover);
      await loadHandovers();
    } catch (err: any) {
      showNotice("err", err?.message || "Lỗi khi xác nhận phiếu bàn giao");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (record: ShiftHandoverRecord) => {
    if (
      !window.confirm(
        `Bạn có chắc muốn xóa phiếu bàn giao ca ngày ${record.date} của ${record.fromStaffName}?`
      )
    ) {
      return;
    }
    setActionLoading(true);
    try {
      await deleteShiftHandoverApi(record._id);
      showNotice("ok", "Đã xóa phiếu bàn giao ca");
      if (selectedHandover?._id === record._id) {
        setSelectedHandover(null);
      }
      await loadHandovers();
    } catch (err: any) {
      showNotice("err", err?.message || "Không thể xóa phiếu bàn giao ca");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredItems = handovers.filter((h) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const matchStaff =
      (h.fromStaffName || "").toLowerCase().includes(q) ||
      (h.toStaffName || "").toLowerCase().includes(q);
    const matchNote =
      (h.notes || "").toLowerCase().includes(q) ||
      (h.confirmNote || "").toLowerCase().includes(q);
    const matchProduct = Array.isArray(h.discrepancies)
      ? h.discrepancies.some(
          (d) =>
            (d.productCode || "").toLowerCase().includes(q) ||
            (d.productName || "").toLowerCase().includes(q)
        )
      : false;
    return matchStaff || matchNote || matchProduct;
  });

  const totalCount = filteredItems.length;
  const pendingCount = filteredItems.filter((h) => h.status === "PENDING").length;
  const acceptedCount = filteredItems.filter(
    (h) => h.status === "ACCEPTED" || h.status === "STORE_CLOSED"
  ).length;
  const discrepancyCount = filteredItems.filter(
    (h) =>
      h.status === "DISCREPANCY_REPORTED" ||
      (Array.isArray(h.discrepancies) && h.discrepancies.length > 0)
  ).length;

  const renderStatusBadge = (h: ShiftHandoverRecord) => {
    const hasDiff = Array.isArray(h.discrepancies) && h.discrepancies.length > 0;
    if (h.status === "DRAFT") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-200 text-slate-800 text-xs font-bold">
          <FileEdit className="w-3.5 h-3.5" />
          Bản nháp trong ca
        </span>
      );
    }
    if (h.status === "PENDING") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
          <Clock className="w-3.5 h-3.5" />
          {h.shiftCode === "SHIFT_1" ? "Chờ Ca 2 xác nhận" : "Chờ Ca 1 sáng sau xác nhận"}
        </span>
      );
    }
    if (h.status === "DISCREPANCY_REPORTED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold">
          <AlertTriangle className="w-3.5 h-3.5" />
          Báo lệch bàn giao
        </span>
      );
    }
    if (h.status === "STORE_CLOSED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-bold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Kết ca đóng cửa {hasDiff ? `(${h.discrepancies.length} lệch)` : ""}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Đã xác nhận {hasDiff ? `(${h.discrepancies.length} lệch)` : ""}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Cấu hình danh mục kiểm cố định theo Thứ trong tuần */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200">
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
          <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Shuffle className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-emerald-950">Lịch kiểm hàng theo ngày:</div>
                <div className="text-[11px] text-emerald-700">Cố định theo Thứ (Vợt + Nhóm cấu hình)</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={previewDate}
                onChange={(e) => setPreviewDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-white border border-emerald-300 text-xs font-bold text-slate-800 outline-none"
              />
              <span className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold shadow-xs">
                {dailyCheck?.checkedCategoryLabel || "Vợt + ..."}
              </span>
              {dailyCheck && (
                <span className="text-xs font-bold text-emerald-900 bg-white px-2.5 py-1.5 rounded-xl border border-emerald-200">
                  Tổng tồn T1: {dailyCheck.totalExpectedQty ?? 0} SP ({dailyCheck.totalCheckedProducts} mã)
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowScheduleConfig((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>{showScheduleConfig ? "Đóng cấu hình" : "Cấu hình lịch tuần"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bảng cấu hình lịch kiểm hàng cố định Thứ 2 -> Chủ Nhật cho Quản lý */}
        {showScheduleConfig && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-emerald-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-emerald-600" />
                  Cấu Hình Lịch Kiểm Hàng Cố Định Theo Thứ Trong Tuần (Luôn gồm Vợt + Danh mục đi kèm)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Chọn hoặc nhập danh mục kiểm kèm với Vợt cho từng ngày. Có thể nhập nhiều danh mục cách nhau bởi dấu &quot;+&quot; (VD: Vớ + Quấn cán).
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveScheduleConfig}
                disabled={savingSchedule}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingSchedule ? "Đang lưu..." : "Lưu lịch kiểm tuần"}</span>
              </button>
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
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                          Vợt + ...
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-emerald-800 mt-1 truncate">
                        Vợt + {selectValue}
                      </div>
                    </div>

                    <div>
                      <select
                        value={selectValue}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleChangeWeekdayCompanion(day.key, e.target.value);
                          }
                        }}
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
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
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {notice.type === "ok" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
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
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <div className="text-xs text-emerald-800 font-semibold">Đã xác nhận / Hoàn tất</div>
            <div className="text-2xl font-black text-emerald-900 mt-1">{acceptedCount}</div>
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
              className="rounded text-emerald-600"
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
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="button"
            onClick={loadHandovers}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
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
                filteredItems.map((h) => {
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
                          <div className="text-[10px] font-bold text-emerald-700 mt-0.5">
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
                                ? "text-emerald-700 font-bold"
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
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold text-[11px]">
                          <Boxes className="w-3 h-3 text-emerald-600" />
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
                          <span className="text-emerald-700 font-bold text-xs">
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
        </div>
      </div>

      {/* Modal Xem Chi Tiết & Duyệt Phiếu Bàn Giao */}
      {selectedHandover && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base">
                  Chi Tiết Phiếu Bàn Giao Ca ({selectedHandover.date})
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  {shiftLabel(selectedHandover.shiftCode)} • Lập bởi{" "}
                  <b className="text-emerald-400">{selectedHandover.fromStaffName}</b>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHandover(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
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

                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <div className="text-emerald-800 font-bold flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-emerald-600" />
                    <span>Nhóm hàng kiểm theo ngày</span>
                  </div>
                  <div className="font-extrabold text-sm text-emerald-950 mt-1">
                    {Array.isArray(selectedHandover.checkedCategories) &&
                    selectedHandover.checkedCategories.length > 0
                      ? selectedHandover.checkedCategories.join(" + ")
                      : "Vợt + Nhóm ngẫu nhiên"}
                  </div>
                  {typeof selectedHandover.totalCheckedProducts === "number" &&
                    selectedHandover.totalCheckedProducts > 0 && (
                      <div className="text-[11px] text-emerald-700">
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
                <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                  <span className="font-bold text-emerald-900">
                    Mốc thời gian chốt gửi bàn giao (tính giờ Check-out cho người giao ca):
                  </span>
                  <span className="font-mono font-extrabold text-emerald-800">
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
                <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200">
                  <span className="font-bold text-sky-800">Ghi chú xác nhận nhận ca: </span>
                  <span className="text-sky-950">{selectedHandover.confirmNote}</span>
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
                                    <span className="text-emerald-700">Khớp (0)</span>
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
                  <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-emerald-800 font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
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
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <label className="block font-bold text-slate-700">
                  Ghi chú xác nhận / đối soát của Quản lý (Admin / Kế toán)
                </label>
                <input
                  type="text"
                  value={adminConfirmNote}
                  onChange={(e) => setAdminConfirmNote(e.target.value)}
                  placeholder="Nhập ghi chú xác nhận hoặc xử lý chênh lệch..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
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
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm transition cursor-pointer"
                  >
                    ✓ Xác nhận khớp bàn giao
                  </button>
                </div>
              </div>
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
    </div>
  );
}
