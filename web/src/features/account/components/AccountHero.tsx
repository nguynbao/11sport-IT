import React from "react";
import { Phone, BadgeCheck, ArrowLeft, Hash, AtSign, Building2 } from "lucide-react";
import { formatPhone } from "@/shared/utils/format";
import type { AccountProfileState } from "../hooks/useAccountProfile";
import type { StaffUser, UserRole } from "@/shared/types";

export default function AccountHero({ p, currentUser, onBack, getRoleDisplayName }: { p: AccountProfileState; currentUser: StaffUser; onBack: () => void; getRoleDisplayName: (role?: UserRole) => string }) {
  const { fullName, phone, positionTitle, department } = p;
  return (
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 text-white rounded-2xl p-5 md:p-6 shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-black text-2xl shrink-0 shadow-inner">
            {(fullName || currentUser.username || "U").charAt(0).toUpperCase()}
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg md:text-xl font-extrabold tracking-tight text-white">
                {fullName || currentUser.fullName}
              </h2>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-lg bg-blue-600 text-white font-bold">
                {getRoleDisplayName(currentUser.role)}
              </span>
              {positionTitle && (
                <span className="text-[11px] px-2.5 py-0.5 rounded-lg bg-white/15 text-slate-200 font-bold">
                  {positionTitle}
                </span>
              )}
              <span className="inline-flex items-center gap-1 bg-blue-500/15 border border-blue-500/30 text-blue-300 px-2.5 py-0.5 rounded-lg text-[11px] font-bold">
                <BadgeCheck className="w-3.5 h-3.5 text-blue-400" />
                Đang hoạt động
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1 font-mono">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                Mã NV: <strong className="text-white">{currentUser.code || "N/A"}</strong>
              </span>
              <span className="inline-flex items-center gap-1 font-mono">
                <AtSign className="w-3.5 h-3.5 text-slate-400" />
                Username: <strong className="text-white">{currentUser.username}</strong>
              </span>
              <span className="inline-flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                Khối:{" "}
                <strong className="text-white">
                  {department === "OFFICE" ? "Văn phòng" : "Bán hàng"}
                </strong>
              </span>
              {phone && (
                <span className="inline-flex items-center gap-1 font-mono">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <strong className="text-white">{formatPhone(phone)}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="self-start md:self-center px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại làm việc</span>
        </button>
      </div>
  );
}
