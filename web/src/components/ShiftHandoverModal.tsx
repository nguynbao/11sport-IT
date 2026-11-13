"use client";

import React, { useState, useEffect } from "react";
import {
  StaffUser,
  DailyHandoverCheckData,
  DailyHandoverCategorySummary,
  ShiftHandoverRecord,
  ShiftHandoverCategoryCount,
  fetchDailyHandoverCheckApi,
  createHandoverApi,
} from "@/lib/api";
import {
  Boxes,
  AlertCircle,
  Coins,
  Send,
  X,
  Plus,
  Minus,
  CheckCircle2,
  Save,
  Clock,
  FileText,
  AlertTriangle,
} from "lucide-react";

interface Props {
  currentUser: StaffUser | null;
  shiftCode?: "SHIFT_1" | "SHIFT_2" | "BOTH";
  existingHandover?: ShiftHandoverRecord | null;
  canConfirmCheckout?: boolean;
  shiftEndLabel?: string;
  initialMode?: "DRAFT" | "CHECKOUT";
  onClose: () => void;
  onSavedDraft?: (handover: ShiftHandoverRecord) => void;
  onSuccess: (handover?: ShiftHandoverRecord, lateCheckoutReason?: string) => void;
}

function formatMoneyInput(val: number | string | undefined | null): string {
  if (val === 0 || val === "0") return "0";
  const digits = String(val ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "0";
  return Number(digits).toLocaleString("vi-VN");
}

function parseMoneyInput(raw: string): number {
  const digits = String(raw || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return 0;
  return Number(digits) || 0;
}

export default function ShiftHandoverModal({
  currentUser: _currentUser,
  shiftCode = "SHIFT_1",
  existingHandover = null,
  canConfirmCheckout,
  shiftEndLabel,
  onClose,
  onSavedDraft,
  onSuccess,
}: Props) {
  const [cashBalance, setCashBalance] = useState<number>(
    existingHandover ? Number(existingHandover.cashBalance || 0) : 0
  );
  const [note, setNote] = useState<string>(existingHandover?.notes || "");
  const [lateReason, setLateReason] = useState<string>(
    existingHandover?.lateCheckoutReason || ""
  );
  const [dailyCheck, setDailyCheck] = useState<DailyHandoverCheckData | null>(null);
  const [summaries, setSummaries] = useState<DailyHandoverCategorySummary[]>([]);
  const [actualTotals, setActualTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [savedNotice, setSavedNotice] = useState("");

  // Tính toán giờ kết thúc ca & trạng thái được phép xác nhận Check-out
  const now = new Date();
  const totalMinutesNow = now.getHours() * 60 + now.getMinutes();
  const isEnd21 = shiftCode === "SHIFT_2" || shiftCode === "BOTH";
  const shiftEndMinutes = isEnd21 ? 21 * 60 : 17 * 60 + 30;
  const effectiveEndLabel = shiftEndLabel || (isEnd21 ? "21:00" : "17:30");
  const isReachedCheckoutTime =
    typeof canConfirmCheckout === "boolean"
      ? canConfirmCheckout
      : totalMinutesNow >= shiftEndMinutes;

  const diffLateMinutes = Math.max(0, totalMinutesNow - shiftEndMinutes);
  const isLateSubmit =
    isReachedCheckoutTime && shiftCode !== "BOTH" && diffLateMinutes > 5;

  useEffect(() => {
    loadDailyCheckSummary();
  }, [existingHandover?._id]);

  const loadDailyCheckSummary = async () => {
    setLoading(true);
    try {
      const data = await fetchDailyHandoverCheckApi();
      setDailyCheck(data);

      // Lấy danh sách tổng theo mặt hàng kiểm trong ngày (tất cả bao gồm size, màu)
      let catSummaries: DailyHandoverCategorySummary[] = Array.isArray(data.categorySummaries)
        ? data.categorySummaries
        : [];

      if (catSummaries.length === 0) {
        const prods = Array.isArray(data.products) ? data.products : [];
        const cats = Array.isArray(data.checkedCategories) ? data.checkedCategories : ["Vợt"];
        catSummaries = cats.map((catName, idx) => {
          const matching = prods.filter((p) => p.categoryName === catName);
          const expectedTotalQty = matching.reduce(
            (sum, p) => sum + (Number(p.stockQtyFloor1) || 0),
            0
          );
          return {
            categoryId: catName,
            categoryCode: catName.toUpperCase(),
            categoryName: catName,
            isPrimaryCategory: idx === 0,
            unit: matching[0]?.unit || "Cái",
            productCount: matching.length,
            expectedTotalQty,
          };
        });
      }

      setSummaries(catSummaries);

      // Khởi tạo số lượng tổng: nếu đã có bản nháp (existingHandover) thì lấy số đã lưu, nếu chưa thì mặc định bằng 0
      const savedMap = new Map<string, number>();
      if (existingHandover && Array.isArray(existingHandover.categoryCounts)) {
        for (const c of existingHandover.categoryCounts) {
          if (c.categoryCode) savedMap.set(c.categoryCode, Number(c.actualTotalQty));
          if (c.categoryName) savedMap.set(c.categoryName, Number(c.actualTotalQty));
        }
      }

      const initTotals: Record<string, number> = {};
      for (const s of catSummaries) {
        const key = s.categoryCode || s.categoryName;
        const savedVal =
          savedMap.get(s.categoryCode) ?? savedMap.get(s.categoryName);
        initTotals[key] =
          typeof savedVal === "number" && !Number.isNaN(savedVal)
            ? savedVal
            : 0;
      }
      setActualTotals(initTotals);

      if (existingHandover) {
        setCashBalance(Number(existingHandover.cashBalance || 0));
        setNote(existingHandover.notes || "");
        if (existingHandover.lateCheckoutReason) {
          setLateReason(existingHandover.lateCheckoutReason);
        }
      }
    } catch {
      setErrorMsg("Không thể tải thông tin tổng số lượng kiểm hàng hôm nay");
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustTotal = (key: string, delta: number) => {
    setActualTotals((prev) => {
      const current = prev[key] ?? 0;
      return { ...prev, [key]: Math.max(0, current + delta) };
    });
  };

  const handleDirectTotalChange = (key: string, rawVal: string) => {
    const cleaned = rawVal.replace(/\D/g, "");
    const num = cleaned === "" ? 0 : Math.max(0, Number(cleaned));
    setActualTotals((prev) => ({ ...prev, [key]: num }));
  };

  const buildPayload = (isDraft: boolean) => {
    const categoryCounts: ShiftHandoverCategoryCount[] = summaries.map((s) => {
      const key = s.categoryCode || s.categoryName;
      const actualTotalQty = actualTotals[key] ?? 0;
      return {
        categoryId: s.categoryId,
        categoryCode: s.categoryCode,
        categoryName: s.categoryName,
        expectedTotalQty: s.expectedTotalQty,
        actualTotalQty,
        unit: s.unit || "Cái",
        productCount: s.productCount,
        note: note.trim(),
      };
    });

    const totalCheckedQty = summaries.reduce((sum, s) => sum + s.expectedTotalQty, 0);

    return {
      date: dailyCheck?.date,
      shiftCode,
      isDraft,
      cashBalance: Number(cashBalance) || 0,
      checkedCategories:
        dailyCheck?.checkedCategories || summaries.map((s) => s.categoryName),
      totalCheckedProducts: totalCheckedQty,
      categoryCounts,
      notes: note.trim(),
      lateCheckoutReason: !isDraft && isLateSubmit ? lateReason.trim() : undefined,
      requireLateReason: !isDraft && isLateSubmit,
    };
  };

  const handleSaveDraft = async () => {
    setErrorMsg("");
    setSavedNotice("");
    setSubmitting(true);
    try {
      const res = await createHandoverApi(buildPayload(true));
      setSavedNotice("Đã lưu bản nháp kiểm hàng! Bạn có thể cập nhật tiếp trong ca.");
      if (onSavedDraft) {
        onSavedDraft(res.handover);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Không thể lưu bản nháp kiểm hàng");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSavedNotice("");

    if (!isReachedCheckoutTime) {
      await handleSaveDraft();
      return;
    }

    if (isLateSubmit && !lateReason.trim()) {
      setErrorMsg(
        `Bạn đang gửi bàn giao & check-out trễ ${diffLateMinutes} phút (quá 5 phút sau ${effectiveEndLabel}). Vui lòng nhập lý do check-out trễ!`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await createHandoverApi(buildPayload(false));
      onSuccess(res.handover, isLateSubmit ? lateReason.trim() : "");
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi gửi biên bản bàn giao ca");
    } finally {
      setSubmitting(false);
    }
  };

  const checkedCategories =
    dailyCheck?.checkedCategories || summaries.map((s) => s.categoryName);
  const diffCategoriesCount = summaries.filter((s) => {
    const key = s.categoryCode || s.categoryName;
    return (actualTotals[key] ?? 0) !== s.expectedTotalQty;
  }).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 text-slate-900">
      <div className="bg-white text-slate-900 rounded-3xl max-w-xl w-full max-h-[92vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base">
                  Kiểm Hàng & Bàn Giao Ca ({checkedCategories.join(" + ") || "Vợt + ..."})
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    isReachedCheckoutTime
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  }`}
                >
                  {isReachedCheckoutTime ? "Đúng giờ Check-out" : "Bản nháp trong ca"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isReachedCheckoutTime
                  ? "Xác nhận gửi bàn giao cho ca sau • Tính giờ Check-out đúng lúc bấm xác nhận"
                  : `Cập nhật nháp trong quá trình làm • Đúng ${effectiveEndLabel} sẽ mở nút Xác nhận Check-out`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConfirmSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {savedNotice && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{savedNotice}</span>
            </div>
          )}

          {/* Mục 1: Tổng số lượng mặt hàng kiểm trong ngày (Tất cả bao gồm size, màu - không cần ghi chi tiết từng mã) */}
          <div className="space-y-3">
            <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-extrabold text-emerald-950">
                  1. Tổng Số Lượng Mặt Hàng Kiểm Hôm Nay ({dailyCheck?.date || "Hôm nay"})
                </div>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  Chỉ cần nhập <b>tổng số lượng</b> của từng nhóm (đã gộp tất cả mã, size, màu tại Tầng 1):
                </p>
              </div>
              <span className="px-3 py-1 rounded-xl bg-emerald-600 text-white text-xs font-extrabold shrink-0">
                {checkedCategories.join(" + ") || "Vợt"}
              </span>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Đang tải tổng số lượng mặt hàng kiểm hôm nay...
              </div>
            ) : (
              <div className="space-y-2.5">
                {summaries.map((item) => {
                  const key = item.categoryCode || item.categoryName;
                  const expected = item.expectedTotalQty;
                  const actual = actualTotals[key] ?? 0;
                  const diff = actual - expected;
                  const isDiff = diff !== 0;

                  return (
                    <div
                      key={key}
                      className={`p-4 rounded-2xl border transition ${
                        isDiff
                          ? "bg-amber-50/70 border-amber-300"
                          : "bg-slate-50/80 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold ${
                                item.isPrimaryCategory
                                  ? "bg-emerald-600 text-white"
                                  : "bg-sky-600 text-white"
                              }`}
                            >
                              {item.categoryName}
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              Tổng tất cả size, màu ({item.productCount} mã)
                            </span>
                          </div>

                          <div className="mt-1.5 flex items-center gap-3 text-xs">
                            <span className="text-slate-600">
                              Tồn Tầng 1 để đối chiếu:{" "}
                              <b className="font-mono text-sm text-slate-900">
                                {expected}
                              </b>{" "}
                              {item.unit || "Cái"}
                            </span>
                            {isDiff ? (
                              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[11px]">
                                {diff > 0
                                  ? `Thừa +${diff} ${item.unit || "Cái"}`
                                  : `Thiếu ${diff} ${item.unit || "Cái"}`}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                                Khớp tồn Tầng 1
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Ô nhập tổng số lượng thực đếm */}
                        <div className="flex flex-col items-end shrink-0">
                          <span className="text-[10px] font-bold text-slate-500 mb-1">
                            Tổng thực đếm
                          </span>
                          <div className="flex items-center gap-1 bg-white border border-slate-300 p-1 rounded-xl shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleAdjustTotal(key, -1)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={actual}
                              onChange={(e) => handleDirectTotalChange(key, e.target.value)}
                              className={`w-16 text-center font-mono text-sm font-black bg-transparent outline-none ${
                                isDiff ? "text-amber-700" : "text-emerald-700"
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => handleAdjustTotal(key, 1)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mục 2: Tiền mặt trong quầy */}
          <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-2">
            <label className="flex items-center gap-2 text-amber-950 font-extrabold text-xs">
              <Coins className="w-4 h-4 text-amber-600" />
              <span>2. Tiền Mặt Trong Quầy (VND) *</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              required
              value={formatMoneyInput(cashBalance)}
              onChange={(e) => setCashBalance(parseMoneyInput(e.target.value))}
              placeholder="Nhập số tiền mặt hiện có trong quầy..."
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 placeholder:text-slate-400 border border-amber-300 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          {/* Mục 3: Ô Lý do (có thể ghi hoặc không) */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <label className="flex items-center justify-between text-slate-800 font-extrabold text-xs">
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>3. Lý Do / Ghi Chú Bàn Giao (Có thể ghi hoặc không)</span>
              </span>
              {diffCategoriesCount > 0 && (
                <span className="text-[11px] font-bold text-amber-700">
                  Đang lệch {diffCategoriesCount} nhóm hàng
                </span>
              )}
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi lý do nếu lệch số lượng hoặc ghi chú dặn ca sau (không bắt buộc)..."
              className="w-full px-3.5 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          {/* Mục 4: Hỏi lý do Check-out trễ / Gửi phiếu trễ (khi gửi trễ > 5 phút sau giờ tan ca) */}
          {isLateSubmit && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
              <label className="flex items-center gap-1.5 text-rose-900 font-extrabold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  Lý Do Check-out / Gửi Phiếu Trễ ({diffLateMinutes} phút sau {effectiveEndLabel}) *
                </span>
              </label>
              <p className="text-[11px] text-rose-700">
                Bạn đang xác nhận gửi bàn giao trễ quá 5 phút sau giờ kết ca. Vui lòng nhập lý do để HR xem xét:
              </p>
              <textarea
                rows={2}
                value={lateReason}
                onChange={(e) => setLateReason(e.target.value)}
                placeholder="VD: Ở lại tư vấn khách muộn / kiểm hàng cuối ca..."
                className="w-full px-3.5 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-rose-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>
          )}

          {/* Thông báo quy tắc tính giờ */}
          <div className="p-3 rounded-xl bg-slate-100 text-[11px] text-slate-600 flex items-start gap-2">
            <Clock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              {isReachedCheckoutTime ? (
                <>
                  Khi bấm <b>Xác nhận gửi bàn giao & Check-out</b>, hệ thống sẽ{" "}
                  <b>chốt ngay giờ ra ca của bạn tại thời điểm bấm nút này</b> (kể cả khi nhân viên ca sau đếm lại trễ 15 phút mới bấm xác nhận).
                </>
              ) : (
                <>
                  Chưa tới giờ tan ca (<b>{effectiveEndLabel}</b>). Bạn có thể bấm <b>Lưu bản nháp</b> để cập nhật số lượng đếm được trong ca làm việc.
                </>
              )}
            </div>
          </div>

          {/* Footer nút bấm */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Đóng
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={submitting || loading}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{submitting ? "Đang lưu..." : "Lưu Bản Nháp"}</span>
              </button>

              {isReachedCheckoutTime ? (
                <button
                  type="submit"
                  disabled={submitting || loading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-lg transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {submitting
                      ? "Đang gửi..."
                      : shiftCode === "SHIFT_1"
                      ? "Xác Nhận Gửi Ca 2 & Check-out"
                      : "Xác Nhận Gửi Bàn Giao & Check-out"}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  title={`Chờ đến đúng giờ tan ca (${effectiveEndLabel}) để mở nút Xác nhận gửi bàn giao & Check-out`}
                  className="px-4 py-2.5 bg-slate-200 text-slate-500 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-not-allowed"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Mở xác nhận lúc {effectiveEndLabel}</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
