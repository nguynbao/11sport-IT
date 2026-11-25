"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TimesheetData, TimesheetRow, TimesheetCell, TimesheetCellCode, TimesheetDay, Department } from "@/shared/types";
import { fetchTimesheetApi, adjustAttendanceApi, createManualAttendanceApi } from "../api";
import { buildSheet, downloadExcel, excelFileName, ExcelColumn } from "@/shared/lib/excel";
import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  Users,
  AlertTriangle,
  UserX,
  LogOut,
  Activity,
  CheckCircle2,
  X,
  Pencil,
  Plus,
  LayoutGrid,
  ListChecks,
  RefreshCw,
} from "lucide-react";
import {
  CELL_STYLE,
  WEEKDAY_SHORT,
  ViewMode,
  IssueFilter,
  EditTarget,
  formatMinutes,
  hasIssue,
  SHIFT_DEFAULT_TIMES,
  HOURS_24,
  MINUTES_60,
} from "../timesheet.constants";
import { Time24Input } from "./Time24Input";

export function CellDetailModal({
  target,
  onClose,
  onSaved,
}: {
  target: EditTarget;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const { row, day, cell } = target;
  const hasRecord = Boolean(cell.attendanceId);
  const isSales = row.department === "SALES";
  const isFulltime = row.contractType === "FULLTIME";
  const initialIsOff = cell.code === "LEAVE" || cell.code === "PAID_LEAVE";
  const defaultWorkShift = (cell.shiftCode || "SHIFT_1") as "SHIFT_1" | "SHIFT_2" | "BOTH";
  const initialIsWfh =
    cell.checkInType === "WFH" ||
    cell.code === "WFH" ||
    Boolean(cell.leaveRequests?.some((l) => l.type === "WFH" && l.status === "APPROVED"));

  const [shiftCode, setShiftCode] = useState<"SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF">(
    initialIsOff ? "OFF" : defaultWorkShift
  );
  const [checkInType, setCheckInType] = useState<"STANDARD" | "WFH">(
    initialIsWfh ? "WFH" : "STANDARD"
  );
  const [offType, setOffType] = useState<"OFF" | "PAID_LEAVE">(
    cell.code === "PAID_LEAVE" ? "PAID_LEAVE" : "OFF"
  );
  const [checkIn, setCheckIn] = useState(
    cell.checkIn || SHIFT_DEFAULT_TIMES[defaultWorkShift].checkIn
  );
  const [checkOut, setCheckOut] = useState(
    cell.checkOut || SHIFT_DEFAULT_TIMES[defaultWorkShift].checkOut
  );
  const [overtimeStatus, setOvertimeStatus] = useState<"NONE" | "PENDING" | "APPROVED" | "REJECTED">(
    cell.overtimeStatus || "NONE"
  );
  const [overtimeApprovedMinutes, setOvertimeApprovedMinutes] = useState<number>(
    cell.overtimeApprovedMinutes || cell.lateCheckoutMinutes || 0
  );
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const style = CELL_STYLE[cell.code];
  const [yy, mm, dd] = day.date.split("-");

  const handleSelectShift = (sc: "SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF") => {
    setShiftCode(sc);
    if (sc !== "OFF") {
      setCheckIn(SHIFT_DEFAULT_TIMES[sc].checkIn);
      setCheckOut(SHIFT_DEFAULT_TIMES[sc].checkOut);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErr("Vui lòng nhập lý do để lưu vết điều chỉnh.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      if (shiftCode === "OFF") {
        if (hasRecord) {
          await adjustAttendanceApi(cell.attendanceId!, {
            shiftCode: "OFF",
            offType,
            reason: reason.trim(),
          });
        } else {
          await createManualAttendanceApi({
            staffId: row.staffId,
            date: day.date,
            shiftCode: "OFF",
            offType,
            reason: reason.trim(),
          });
        }
        onSaved(
          `Đã chấm ${offType === "PAID_LEAVE" ? "Nghỉ phép có lương" : "OFF (Nghỉ không lương)"} cho ${row.staffName} ngày ${dd}/${mm}`
        );
      } else if (hasRecord) {
        await adjustAttendanceApi(cell.attendanceId!, {
          checkIn,
          checkOut: checkOut || undefined,
          shiftCode: isSales ? shiftCode : "SHIFT_1",
          checkInType,
          overtimeStatus: shiftCode === "BOTH" ? "NONE" : overtimeStatus,
          overtimeApprovedMinutes:
            shiftCode !== "BOTH" && overtimeStatus === "APPROVED"
              ? Math.max(0, Number(overtimeApprovedMinutes) || 0)
              : 0,
          reason: reason.trim(),
        });
        onSaved(
          `Đã điều chỉnh giờ công ${checkInType === "WFH" ? "(WFH) " : ""}${row.staffName} ngày ${dd}/${mm}`
        );
      } else {
        await createManualAttendanceApi({
          staffId: row.staffId,
          date: day.date,
          shiftCode: isSales ? shiftCode : "SHIFT_1",
          checkInType,
          checkIn,
          checkOut: checkOut || undefined,
          overtimeStatus:
            shiftCode !== "BOTH" && overtimeStatus === "APPROVED" ? "APPROVED" : "NONE",
          overtimeApprovedMinutes:
            shiftCode !== "BOTH" && overtimeStatus === "APPROVED"
              ? Math.max(0, Number(overtimeApprovedMinutes) || 0)
              : 0,
          reason: reason.trim(),
        });
        onSaved(
          `Đã chấm công bù ${checkInType === "WFH" ? "(WFH) " : ""}cho ${row.staffName} ngày ${dd}/${mm}`
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
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
          <div>
            <div className="text-xs text-slate-500 font-semibold">
              {WEEKDAY_SHORT[day.weekday]}, {dd}/{mm}/{yy}
              {day.holiday && (
                <span
                  className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${day.holiday.isOfficialDayOff ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"
                    }`}
                >
                  {day.holiday.name}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">
              {row.staffName} <span className="text-xs font-mono text-slate-400">{row.staffCode}</span>
            </h3>
            <span
              className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded text-[11px] font-bold ${style.className}`}
            >
              {style.symbol && <span>{style.symbol}</span>}
              {style.label}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {hasRecord && (
          <div className="px-5 py-3 bg-slate-50 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <div className="text-slate-400">Giờ vào (24h)</div>
              <div className="font-mono font-bold text-slate-900">{cell.checkIn || "—"}</div>
            </div>
            <div>
              <div className="text-slate-400">Giờ ra (24h)</div>
              <div className={`font-mono font-bold ${cell.checkOut ? "text-slate-900" : "text-red-600"}`}>
                {cell.checkOut || "Chưa ra"}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Giờ công</div>
              <div className="font-mono font-bold text-brand-ink">{cell.hours ? `${cell.hours}h` : "—"}</div>
            </div>
            {(cell.lateMinutes || cell.earlyMinutes) ? (
              <div className="col-span-3 text-[11px] text-slate-600">
                {cell.lateMinutes ? `Trễ ${cell.lateMinutes} phút` : ""}
                {cell.lateMinutes && cell.earlyMinutes ? " • " : ""}
                {cell.earlyMinutes ? `Về sớm ${cell.earlyMinutes} phút` : ""}
              </div>
            ) : null}
            {cell.adjusted && (
              <div className="col-span-3 text-[11px] text-slate-500 italic">
                Đã điều chỉnh bởi {cell.adjustedByName || "HR"}: {cell.adjustReason}
              </div>
            )}
            {!!cell.lateCheckoutMinutes && (
              <div className="col-span-3 p-2 rounded-lg bg-amber-50 border border-amber-200 text-left text-[11px] text-amber-900">
                <div>
                  <b>Check-out trễ sau giờ kết ca:</b> {cell.lateCheckoutMinutes} phút{" "}
                  <span className="font-bold">
                    (
                    {cell.overtimeStatus === "APPROVED"
                      ? `HR đã duyệt tính tăng ca ${cell.overtimeMinutes || cell.overtimeApprovedMinutes}p`
                      : cell.overtimeStatus === "REJECTED"
                        ? "HR không tính tăng ca"
                        : "⏳ Đang chờ HR xem xét"}
                    )
                  </span>
                </div>
                {cell.lateCheckoutReason && (
                  <div className="mt-0.5 text-slate-700">
                    <b>Lý do NV giải trình:</b> {cell.lateCheckoutReason}
                  </div>
                )}
              </div>
            )}
            {cell.note && !cell.adjusted && (
              <div className="col-span-3 text-[11px] text-slate-500 italic">{cell.note}</div>
            )}
          </div>
        )}

        <form onSubmit={handleSave} className="px-5 py-4 space-y-3">
          <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              {hasRecord ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {hasRecord ? "Điều chỉnh giờ công / Chuyển OFF" : "Chấm công bù / Chấm OFF cho ngày này"}
            </span>
            <span className="text-[11px] font-normal text-slate-400">Định dạng 0h–24h</span>
          </div>

          {/* Chọn Ca làm việc hoặc OFF (tự động điều chỉnh giờ vào/ra khi chọn ca) */}
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
                    onClick={() => handleSelectShift(sc)}
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
                onClick={() => handleSelectShift("SHIFT_1")}
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
              onClick={() => handleSelectShift("OFF")}
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

          {shiftCode === "OFF" ? (
            <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 space-y-2 text-xs">
              <div className="font-bold text-purple-900">Chọn hình thức nghỉ OFF cho ngày {dd}/{mm}/{yy}:</div>
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
                      ? `Hạn mức Sales: tối đa 4 ngày/tháng (đã nghỉ ${row.summary.salesOffUsed ?? 0}/4)`
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
                      ? `HĐ Chính thức: 1 ngày/tháng (đã dùng ${row.summary.paidLeaveUsed || 0}/1)`
                      : "Chỉ dành cho HĐ Chính thức"}
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <>
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

              {/* Xét duyệt Tăng ca / Check-out trễ */}
              {isSales ? (
                shiftCode === "BOTH" ? (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                    Nhân viên làm <b>2 ca (Ca 1 + Ca 2: 08:30–21:00)</b> theo bảng xếp ca —{" "}
                    <b>không tính là tăng ca</b>.
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200 space-y-2 text-xs">
                    <div className="font-bold text-indigo-950">
                      Xét duyệt Check-out trễ / Tăng ca (Khối Bán hàng – 1 ca)
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setOvertimeStatus("NONE")}
                        className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${overtimeStatus === "NONE" || overtimeStatus === "REJECTED"
                          ? "bg-slate-800 border-slate-800 text-white"
                          : "bg-white border-slate-200 text-slate-600"
                          }`}
                      >
                        Không tính TC
                      </button>
                      <button
                        type="button"
                        onClick={() => setOvertimeStatus("PENDING")}
                        className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${overtimeStatus === "PENDING"
                          ? "bg-amber-500 border-amber-500 text-white"
                          : "bg-white border-slate-200 text-slate-600"
                          }`}
                      >
                        Chờ xem xét
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOvertimeStatus("APPROVED");
                          if (!overtimeApprovedMinutes && cell.lateCheckoutMinutes) {
                            setOvertimeApprovedMinutes(cell.lateCheckoutMinutes);
                          }
                        }}
                        className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${overtimeStatus === "APPROVED"
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "bg-white border-slate-200 text-slate-600"
                          }`}
                      >
                        ✓ Duyệt Tăng ca
                      </button>
                    </div>
                    {overtimeStatus === "APPROVED" && (
                      <label className="block text-[11px] font-semibold text-indigo-900">
                        Số phút check-out trễ được HR quy thành Tăng ca:
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={overtimeApprovedMinutes > 0 ? overtimeApprovedMinutes.toLocaleString("vi-VN") : ""}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, "").replace(/^0+/, "");
                            setOvertimeApprovedMinutes(digits ? Number(digits) : 0);
                          }}
                          className="mt-1 w-full px-3 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-mono font-bold outline-none"
                        />
                      </label>
                    )}
                  </div>
                )
              ) : (
                <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200 space-y-2 text-xs">
                  <div className="font-bold text-indigo-950">
                    Yêu cầu Tăng ca (Khối Văn phòng – chỉ tính khi HR yêu cầu)
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOvertimeStatus("NONE")}
                      className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${overtimeStatus !== "APPROVED"
                        ? "bg-slate-800 border-slate-800 text-white"
                        : "bg-white border-slate-200 text-slate-600"
                        }`}
                    >
                      Không tăng ca
                    </button>
                    <button
                      type="button"
                      onClick={() => setOvertimeStatus("APPROVED")}
                      className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${overtimeStatus === "APPROVED"
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white border-slate-200 text-slate-600"
                        }`}
                    >
                      ✓ HR yêu cầu Tăng ca
                    </button>
                  </div>
                  {overtimeStatus === "APPROVED" && (
                    <label className="block text-[11px] font-semibold text-indigo-900">
                      Số phút Tăng ca được tính (bỏ trống = tự tính theo giờ ra sau 17:30):
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={overtimeApprovedMinutes > 0 ? overtimeApprovedMinutes.toLocaleString("vi-VN") : ""}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").replace(/^0+/, "");
                          setOvertimeApprovedMinutes(digits ? Number(digits) : 0);
                        }}
                        className="mt-1 w-full px-3 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-mono font-bold outline-none"
                      />
                    </label>
                  )}
                </div>
              )}
            </>
          )}

          <label className="block text-xs font-semibold text-slate-600">
            Lý do (bắt buộc, lưu vết) *
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
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
              Đóng
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Đang lưu..." : shiftCode === "OFF" ? "Lưu chấm OFF" : hasRecord ? "Lưu điều chỉnh" : "Chấm công bù"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal chấm công bù (chọn nhân viên + ngày bất kỳ + tự động giờ theo ca + hỗ trợ OFF)
// ---------------------------------------------------------------------------
