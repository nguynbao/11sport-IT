import React from "react";
import { Info } from "lucide-react";
import type { AccountProfileState } from "../hooks/useAccountProfile";

export default function AccountRulesCard({ p }: { p: AccountProfileState }) {
  const { contractType } = p;
  return (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 uppercase">
              <Info className="w-4 h-4 text-brand-ink shrink-0" />
              <span>Quyền lợi &amp; Quy định Hồ sơ Nhân sự</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Chế độ phép có lương:</strong>{" "}
                  {contractType === "FULLTIME"
                    ? "Bạn đang là nhân viên Chính thức — được hưởng 1 ngày nghỉ phép có lương mỗi tháng."
                    : "Chỉ áp dụng 1 ngày phép có lương/tháng đối với nhân viên Hợp đồng Chính thức."}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Thông tin cá nhân &amp; Ngân hàng:</strong> Nhân viên chủ động cập nhật
                  Họ tên, Ngày sinh, Giới tính, SĐT, Email, CCCD (Ngày cấp / Nơi cấp), Địa chỉ thường trú &amp; hiện tại, Trường học, Chuyên ngành và STK ngân hàng.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Chế độ Lương, BHXH &amp; Hợp đồng:</strong> Vị trí, Số HĐ, BHXH, Lương cơ bản, Trợ
                  cấp, Thưởng và File hợp đồng do bộ phận <strong>Nhân sự (HR)</strong> cập nhật.
                </span>
              </li>
            </ul>
          </div>
  );
}
