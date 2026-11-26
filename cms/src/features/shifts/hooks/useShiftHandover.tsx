
import { apiRequest } from "@/shared/api/client";
import { DEBOUNCE_MS, DEFAULT_PAGE_SIZE } from "@/config/listing";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useClientPagination } from "@/shared/hooks/useClientPagination";
import { Category,DailyHandoverCheckData,HandoverScheduleConfigData,ShiftHandoverRecord,StaffUser } from "@/shared/types";
import {
AlertTriangle,
CheckCircle2,
Clock,
FileEdit
} from "lucide-react";
import { useCallback,useEffect,useState } from "react";
import { confirmShiftHandoverApi,deleteShiftHandoverApi,fetchDailyHandoverCheckApi,fetchHandoverScheduleConfigApi,fetchShiftHandoversApi,updateHandoverScheduleConfigApi } from "../api";
import { API_ENDPOINTS } from "@/shared/api/endpoints";

export const WEEKDAY_LABELS: Array<{ key: string; label: string; short: string }> = [
  { key: "1", label: "Thứ 2", short: "T2" },
  { key: "2", label: "Thứ 3", short: "T3" },
  { key: "3", label: "Thứ 4", short: "T4" },
  { key: "4", label: "Thứ 5", short: "T5" },
  { key: "5", label: "Thứ 6", short: "T6" },
  { key: "6", label: "Thứ 7", short: "T7" },
  { key: "0", label: "Chủ Nhật", short: "CN" },
];

export const DEFAULT_WEEKLY_SCHEDULE: Record<string, string[]> = {
  "1": ["Giày"],
  "2": ["Áo"],
  "3": ["Quần"],
  "4": ["Balo"],
  "5": ["Túi"],
  "6": ["Phụ kiện"],
  "0": ["Bóng"],
};

export function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getMonthStartStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function shiftLabel(code: string) {
  if (code === "SHIFT_1") return "Ca 1 (08:30 - 17:30)";
  if (code === "SHIFT_2") return "Ca 2 (12:00 - 21:00)";
  if (code === "BOTH") return "Cả 2 ca (08:30 - 21:00)";
  return code;
}


export function useShiftHandover({ currentUser }: { currentUser: StaffUser | null }) {
  const isReadOnlySchedule = currentUser?.role === "ACCOUNTANT";
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
        apiRequest<Category[]>(API_ENDPOINTS.CATEGORIES.BASE).catch(() => null),
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

  const debouncedSearchTerm = useDebounce(searchTerm, DEBOUNCE_MS.LOCAL);

  const filteredItems = handovers.filter((h) => {
    if (!debouncedSearchTerm.trim()) return true;
    const q = debouncedSearchTerm.toLowerCase();
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

  const handoverPagination = useClientPagination(filteredItems, DEFAULT_PAGE_SIZE);
  useEffect(() => {
    handoverPagination.resetPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);

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
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-100 text-brand-ink text-xs font-bold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Kết ca đóng cửa {hasDiff ? `(${h.discrepancies.length} lệch)` : ""}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-100 text-brand-ink text-xs font-bold">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Đã xác nhận {hasDiff ? `(${h.discrepancies.length} lệch)` : ""}
      </span>
    );
  };


  return {
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
    selectedHandover,
    setSelectedHandover,
    adminConfirmNote,
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
    handleConfirm,
    handleDelete,
    filteredItems,
    handoverPagination,
    totalCount,
    pendingCount,
    acceptedCount,
    discrepancyCount,
    renderStatusBadge,
  };
}

export type ShiftHandoverViewModel = ReturnType<typeof useShiftHandover>;
