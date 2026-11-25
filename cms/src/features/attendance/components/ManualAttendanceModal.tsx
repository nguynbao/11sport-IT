"use client";
import { TimesheetRow } from "@/shared/types";
import {
X
} from "lucide-react";
import React,{ useState } from "react";
import { createManualAttendanceApi } from "../api";
import {
SHIFT_DEFAULT_TIMES
} from "../timesheet.constants";
import { Time24Input } from "./Time24Input";

export function ManualAttendanceModal({
  rows,
  onClose,
  onSaved,
}: {
  rows: TimesheetRow[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;

  const [staffId, setStaffId] = useState(rows[0]?.staffId || "");
  const [date, setDate] = useState(todayStr);
  const [shiftCode, setShiftCode] = useState<"SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF">("SHIFT_1");
  const [checkInType, setCheckInType] = useState<"STANDARD" | "WFH">("STANDARD");
  const [offType, setOffType] = useState<"OFF" | "PAID_LEAVE">("OFF");
  const [checkIn, setCheckIn] = useState("08:30");
  const [checkOut, setCheckOut] = useState("17:30");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selected = rows.find((r) => r.staffId === staffId);
  const isSales = selected?.department === "SALES";
  const isFulltime = selected?.contractType === "FULLTIME";

  const applyShiftSelection = (sc: "SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF") => {
    setShiftCode(sc);
    if (sc !== "OFF") {
      setCheckIn(SHIFT_DEFAULT_TIMES[sc].checkIn);
      setCheckOut(SHIFT_DEFAULT_TIMES[sc].checkOut);
    }
  };

  const syncShiftForStaffAndDate = (nextStaffId: string, nextDate: string) => {
    const row = rows.find((r) => r.staffId === nextStaffId);
    if (!row) return;
    const cell = row.cells?.[nextDate];
    const hasWfh =
      cell?.checkInType === "WFH" ||
      cell?.code === "WFH" ||
      Boolean(cell?.leaveRequests?.some((l) => l.type === "WFH" && l.status === "APPROVED"));
    setCheckInType(hasWfh ? "WFH" : "STANDARD");

    if (row.department !== "SALES") {
      applyShiftSelection("SHIFT_1");
      return;
    }
    if (cell?.shiftCode === "SHIFT_1" || cell?.shiftCode === "SHIFT_2" || cell?.shiftCode === "BOTH") {
      applyShiftSelection(cell.shiftCode);
    } else {
      applyShiftSelection("SHIFT_1");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId || !reason.trim()) {
      setErr("Vui lòng chọn nhân viên và nhập lý do.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      if (shiftCode === "OFF") {
        await createManualAttendanceApi({
          staffId,
          date,
          shiftCode: "OFF",
          offType: isFulltime ? offType : "OFF",
          reason: reason.trim(),
        });
        onSaved(
          `Đã chấm ${offType === "PAID_LEAVE" && isFulltime ? "Nghỉ phép có lương" : "OFF (Nghỉ không lương)"} cho ${selected?.staffName || "nhân viên"
          }`
        );
      } else {
        await createManualAttendanceApi({
          staffId,
          date,
          shiftCode: isSales ? shiftCode : "SHIFT_1",
          checkInType,
          checkIn,
          checkOut: checkOut || undefined,
          reason: reason.trim(),
        });
        onSaved(
          `Đã chấm công bù ${checkInType === "WFH" ? "(WFH) " : ""}cho ${selected?.staffName || "nhân viên"}`
        );
      }
    } catch (e: any) {
      setErr(e?.message || "Không lưu được");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Chấm công bù / Chấm OFF</h3>
            <p className="text-[11px] text-slate-500">Chọn ca sẽ tự động điền giờ vào – giờ ra chuẩn (0h–24h)</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-600">
              Nhân viên *
              <select
                value={staffId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setStaffId(nextId);
                  syncShiftForStaffAndDate(nextId, date);
                }}
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white"
              >
                {rows.map((r) => (
                  <option key={r.staffId} value={r.staffId}>
                    {r.staffCode} – {r.staffName} ({r.department === "OFFICE" ? "VP" : "BH"})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Ngày *
              <input
                type="date"
                required
                max={shiftCode === "OFF" ? undefined : todayStr}
                value={date}
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setDate(nextDate);
                  if (shiftCode !== "OFF") {
                    syncShiftForStaffAndDate(staffId, nextDate);
                  }
                }}
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white"
              />
            </label>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-600 mb-1.5">
              Chọn ca làm việc hoặc chấm OFF *
            </div>
            <div className={`grid ${isSales ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"} gap-2`}>
              {isSales ? (
                (["SHIFT_1", "SHIFT_2", "BOTH"] as const).map((sc) => {
                  const active = shiftCode === sc;
                  const title = sc === "BOTH" ? "Ca 1 + Ca 2" : sc === "SHIFT_1" ? "Ca 1" : "Ca 2";
                  const timeRange =
                    sc === "BOTH" ? "08:30 – 21:00" : sc === "SHIFT_1" ? "08:30 – 17:30" : "12:00 – 21:00";
                  return (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => applyShiftSelection(sc)}
                      className={`flex flex-col items-center justify-center px-2.5 py-2 min-h-[54px] rounded-xl border cursor-pointer transition ${active
                        ? "bg-teal-50 border-teal-500 text-teal-900 ring-1 ring-teal-500/30 shadow-2xs"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                    >
                      <span className="text-xs font-bold leading-tight whitespace-nowrap">{title}</span>
                      <span
                        className={`text-[11px] font-mono mt-0.5 whitespace-nowrap ${active ? "text-brand-ink font-semibold" : "text-slate-400"
                          }`}
                      >
                        {timeRange}
                      </span>
                    </button>
                  );
                })
              ) : (
                <button
                  type="button"
                  onClick={() => applyShiftSelection("SHIFT_1")}
                  className={`flex flex-col items-center justify-center px-3 py-2 min-h-[54px] rounded-xl border cursor-pointer transition ${shiftCode !== "OFF"
                    ? "bg-teal-50 border-teal-500 text-teal-900 ring-1 ring-teal-500/30 shadow-2xs"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                >
                  <span className="text-xs font-bold leading-tight whitespace-nowrap">Ca Hành chính</span>
                  <span
                    className={`text-[11px] font-mono mt-0.5 whitespace-nowrap ${shiftCode !== "OFF" ? "text-brand-ink font-semibold" : "text-slate-400"
                      }`}
                  >
                    08:30 – 17:30
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => applyShiftSelection("OFF")}
                className={`flex flex-col items-center justify-center px-2.5 py-2 min-h-[54px] rounded-xl border cursor-pointer transition ${shiftCode === "OFF"
                  ? "bg-purple-600 border-purple-600 text-white shadow-2xs"
                  : "bg-purple-50/60 border-purple-200 text-purple-800 hover:bg-purple-100"
                  }`}
              >
                <span className="text-xs font-bold leading-tight whitespace-nowrap">OFF (Nghỉ)</span>
                <span
                  className={`text-[11px] mt-0.5 whitespace-nowrap ${shiftCode === "OFF" ? "text-purple-100 font-medium" : "text-purple-500"
                    }`}
                >
                  Nghỉ cả ngày
                </span>
              </button>
            </div>
          </div>

          {shiftCode === "OFF" ? (
            <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 space-y-2 text-xs">
              <div className="font-bold text-purple-900">Chọn hình thức nghỉ OFF:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOffType("OFF")}
                  className={`p-2 rounded-lg border text-left cursor-pointer transition ${offType === "OFF"
                    ? "bg-white border-purple-600 ring-2 ring-purple-500 text-purple-950 font-bold"
                    : "bg-white/70 border-purple-200 text-slate-600"
                    }`}
                >
                  <div>Nghỉ không lương (OFF)</div>
                  <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                    {isSales
                      ? `Hạn mức Sales: tối đa 4 ngày/tháng (đã dùng ${selected?.summary.salesOffUsed ?? 0}/4)`
                      : "Không tính công ngày này"}
                  </div>
                </button>
                <button
                  type="button"
                  disabled={!isFulltime}
                  onClick={() => setOffType("PAID_LEAVE")}
                  className={`p-2 rounded-lg border text-left transition ${!isFulltime
                    ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                    : offType === "PAID_LEAVE"
                      ? "bg-teal-50 border-teal-600 ring-2 ring-teal-500 text-teal-950 font-bold cursor-pointer"
                      : "bg-white/70 border-purple-200 text-slate-600 cursor-pointer"
                    }`}
                >
                  <div>Nghỉ phép có lương (+1 công)</div>
                  <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                    {isFulltime
                      ? `HĐ Chính thức: 1 ngày/tháng (đã dùng ${selected?.summary.paidLeaveUsed || 0}/1)`
                      : "Chỉ dành cho HĐ Chính thức"}
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Hình thức làm việc: Trực tiếp hay Làm từ xa (WFH) */}
              <div>
                <div className="text-xs font-semibold text-slate-600 mb-1.5">
                  Hình thức chấm công *
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckInType("STANDARD")}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition ${checkInType === "STANDARD"
                      ? "bg-teal-50 border-teal-500 text-teal-900 ring-1 ring-teal-500/30"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    <span className="w-4 h-4 rounded bg-teal-500 text-white text-[9px] font-black inline-flex items-center justify-center">
                      ✓
                    </span>
                    <span>Làm trực tiếp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckInType("WFH")}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition ${checkInType === "WFH"
                      ? "bg-cyan-50 border-cyan-500 text-cyan-900 ring-1 ring-cyan-500/30"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    <span className="w-4 h-4 rounded bg-cyan-600 text-white text-[9px] font-black inline-flex items-center justify-center">
                      W
                    </span>
                    <span>Làm từ xa (WFH)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>Giờ vào *</span>
                  </div>
                  <Time24Input value={checkIn} onChange={setCheckIn} />
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>Giờ ra</span>
                    {checkOut && (
                      <button
                        type="button"
                        onClick={() => setCheckOut("")}
                        className="text-[11px] font-medium text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      >
                        Xóa giờ ra
                      </button>
                    )}
                  </div>
                  <Time24Input value={checkOut} onChange={setCheckOut} allowEmpty />
                </div>
              </div>
            </div>
          )}

          <label className="block text-xs font-semibold text-slate-600">
            Lý do (bắt buộc, lưu vết) *
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Mất mạng không chấm công được / Nhân viên báo nghỉ OFF..."
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </label>
          {err && <div className="text-xs text-rose-600 font-semibold">{err}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Đang lưu..." : shiftCode === "OFF" ? "Lưu chấm OFF" : "Chấm công bù"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
