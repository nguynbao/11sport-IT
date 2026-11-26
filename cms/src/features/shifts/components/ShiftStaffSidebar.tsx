"use client";

import React from "react";
import { Users, Lock } from "lucide-react";
import { ShiftScheduleViewModel } from "../hooks/useShiftSchedule";

export function ShiftStaffSidebar({ vm }: { vm: ShiftScheduleViewModel }) {
  const {
    staffList,
    editMode,
    loading,
    days,
    effectiveCode,
    staffRegistrationStatus,
    setDrag,
    setDropTarget,
    weekCheck,
  } = vm;

  return (
        <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-3 h-fit">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-ink" />
              Nhân sự showroom
            </h3>
            <span className="text-[11px] font-bold text-slate-500">{staffList.length} người</span>
          </div>

          {!editMode && (
            <div className="text-[11px] text-slate-500 flex items-start gap-1.5 bg-white border border-slate-200 rounded-lg p-2">
              <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Bấm <b>“Sửa lịch ca”</b> nếu cần chỉnh tay ca bị trùng, sau đó bấm <b>“Xác nhận & Hoàn tất”</b> để gửi lịch cho Sales.
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            {staffList.map((s) => {
              const shifts = days.map((d) => effectiveCode(s._id, d.date));
              const workDays = shifts.filter((c) => c === "SHIFT_1" || c === "SHIFT_2" || c === "BOTH").length;
              const totalShiftUnits = shifts.reduce(
                (acc, c) => acc + (c === "BOTH" ? 2 : c === "SHIFT_1" || c === "SHIFT_2" ? 1 : 0),
                0
              );
              const offDays = shifts.filter((c) => c === "OFF").length;
              const regStatus = staffRegistrationStatus.get(s._id);
              return (
                <div
                  key={s._id}
                  draggable={editMode}
                  onDragStart={() => setDrag({ staffId: s._id })}
                  onDragEnd={() => {
                    setDrag(null);
                    setDropTarget(null);
                  }}
                  className={`p-2.5 bg-white border border-slate-200 rounded-lg transition flex items-center justify-between gap-2 ${editMode ? "cursor-grab active:cursor-grabbing hover:border-teal-500 hover:shadow-md" : "opacity-90"
                    }`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-bold text-xs text-slate-900 truncate">{s.fullName}</div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-mono">{s.code}</span>
                      {regStatus === "PENDING_HR" && (
                        <span className="px-1.5 py-0.2 rounded bg-[#E0E7FF] text-[#4338CA] text-[9px] font-bold">
                          Đã ĐK • Chờ duyệt
                        </span>
                      )}
                      {regStatus === "CONFIRMED_HR" && (
                        <span className="px-1.5 py-0.2 rounded bg-[#D1FAE5] text-[#047857] text-[9px] font-bold">
                          ✓ HR đã chốt
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] font-extrabold text-[#047857]">
                      {totalShiftUnits > workDays
                        ? `${workDays} ngày (${totalShiftUnits} ca) • ${offDays} nghỉ`
                        : `${workDays} ca • ${offDays} nghỉ`}
                    </div>
                    {(() => {
                      const c = weekCheck.get(s._id);
                      if (!c) return null;
                      return (
                        <div className="space-y-0.5">
                          <div className="text-[10px] font-semibold text-slate-500">
                            OFF tháng: {c.monthUsedAfterWeek}/{c.monthLimit} ngày
                          </div>
                          {c.ok ? (
                            <div className="text-[10px] font-bold text-[#059669]">✓ Đúng quy định</div>
                          ) : (
                            <div className={`text-[10px] font-bold ${c.assigned === 0 ? "text-amber-600" : "text-rose-600"}`}>
                              ⚠ {c.message}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
            {staffList.length === 0 && !loading && (
              <div className="text-xs text-slate-400 text-center py-4">Chưa có nhân viên khối Bán hàng.</div>
            )}
          </div>
        </div>
  );
}
