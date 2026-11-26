"use client";

import { ContractType,UserRole } from "@/shared/types";
import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import { contractTypeLabel } from "@/shared/utils/format";
import {
ArrowDown,
ArrowUp,
ArrowUpDown,
KeyRound,
Lock,
RotateCcw,
Search,
Unlock,
Users
} from "lucide-react";
import { exportStaff } from "../exports";
import { StaffViewModel } from "../hooks/useStaffModule";
import { PaginationBar } from "@/shared/ui/PaginationBar";
import { toIsoDateSlice } from "../utils";

export function StaffListTable({ vm }: { vm: StaffViewModel }) {
  const {
    isCeo,
    isAdminView,
    staffList,
    username,
    fullName,
    phone,
    email,
    companyEmail,
    dateOfBirth,
    gender,
    citizenId,
    permanentAddress,
    currentAddress,
    positionTitle,
    bankAccount,
    role,
    department,
    contractType,
    contractStartDate,
    contractEndDate,
    internContractNumber,
    probationContractNumber,
    officialContractNumber,
    contractFileUrl,
    baseSalary,
    allowance,
    bonus,
    insurance,
    searchQuery,
    setSearchQuery,
    filterDept,
    setFilterDept,
    filterRole,
    setFilterRole,
    filterContract,
    setFilterContract,
    filterStatus,
    setFilterStatus,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    handleOpenProfileModal,
    handleUpdateStaff,
    handleOpenResetPassword,
    hasActiveFilters,
    handleResetFilters,
    handleColumnSort,
    filteredStaffList,
  } = vm;

  return (
    <>
      {/* Danh sách nhân viên */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-ink" />
            Danh sách Nhân viên ({filteredStaffList.length}/{staffList.length})
          </h3>
          <ExportExcelButton
            onExport={() => exportStaff(filteredStaffList)}
            disabled={filteredStaffList.length === 0}
          />
        </div>

        {/* Thanh Bộ lọc (Filter) & Sắp xếp (Sort) */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-wrap items-center gap-2 text-xs">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên, mã NV, username, SĐT, CCCD, vị trí, STK..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value as "ALL" | "OFFICE" | "SALES")}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">Tất cả Khối</option>
            <option value="OFFICE">Khối Văn phòng</option>
            <option value="SALES">Khối Bán hàng</option>
          </select>

          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as "ALL" | UserRole)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">Tất cả Vai trò</option>
            <option value="SALES">SALES (Bán hàng)</option>
            <option value="HR">HR (Nhân sự)</option>
            <option value="ACCOUNTANT">ACCOUNTANT (Kế toán &amp; Kho)</option>
            <option value="MARKETING">MARKETING</option>
            <option value="ADMIN">ADMIN (Quản lý)</option>
            <option value="CEO">CEO (Giám đốc)</option>
          </select>

          <select
            value={filterContract}
            onChange={(e) => setFilterContract(e.target.value as "ALL" | ContractType)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">Tất cả Hợp đồng</option>
            <option value="FULLTIME">Chính thức</option>
            <option value="PROBATION">Thử việc</option>
            <option value="INTERN">Thực tập (Intern)</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "ALL" | "ACTIVE" | "LOCKED")}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">Tất cả Trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="LOCKED">Đã khóa</option>
          </select>

          <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-brand-ink shrink-0" />
            <span className="text-[11px] font-bold text-slate-500">Sắp xếp:</span>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as
                    | "code"
                    | "fullName"
                    | "baseSalary"
                    | "allowance"
                    | "bonus"
                    | "insurance"
                    | "createdAt"
                )
              }
              className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="code">Mã NV</option>
              <option value="fullName">Họ và tên</option>
              <option value="baseSalary">Lương cơ bản</option>
              <option value="allowance">Trợ cấp</option>
              <option value="bonus">Thưởng</option>
              <option value="insurance">Bảo hiểm</option>
              <option value="createdAt">Ngày tạo</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
              title={sortOrder === "asc" ? "Đang xếp Tăng dần" : "Đang xếp Giảm dần"}
              className="ml-1 px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold inline-flex items-center gap-0.5 cursor-pointer"
            >
              {sortOrder === "asc" ? (
                <>
                  <ArrowUp className="w-3 h-3 text-brand-ink" />
                  <span className="text-[10px]">Tăng</span>
                </>
              ) : (
                <>
                  <ArrowDown className="w-3 h-3 text-amber-600" />
                  <span className="text-[10px]">Giảm</span>
                </>
              )}
            </button>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-2.5 py-1.5 rounded-lg bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-bold inline-flex items-center gap-1 cursor-pointer transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Đặt lại</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table data-cards className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
              <tr>
                <th
                  onClick={() => handleColumnSort("code")}
                  className="py-3 px-3.5 cursor-pointer hover:bg-teal-700 select-none whitespace-nowrap"
                >
                  <span className="inline-flex items-center gap-1">
                    Mã NV
                    {sortBy === "code" &&
                      (sortOrder === "asc" ? (
                        <ArrowUp className="w-3 h-3 text-teal-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-amber-400" />
                      ))}
                  </span>
                </th>
                <th
                  onClick={() => handleColumnSort("fullName")}
                  className="py-3 px-3.5 cursor-pointer hover:bg-teal-700 select-none"
                >
                  <span className="inline-flex items-center gap-1">
                    Họ và tên &amp; Liên hệ
                    {sortBy === "fullName" &&
                      (sortOrder === "asc" ? (
                        <ArrowUp className="w-3 h-3 text-teal-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-amber-400" />
                      ))}
                  </span>
                </th>
                <th className="py-3 px-3.5">CCCD &amp; Địa chỉ</th>
                <th className="py-3 px-3.5">Khối &amp; Vị trí</th>
                <th className="py-3 px-3.5">Vai trò (Role)</th>
                <th className="py-3 px-3.5">Hợp đồng &amp; Số HĐ</th>
                <th className="py-3 px-3.5 text-center">Trạng thái</th>
                <th className="py-3 px-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredStaffList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400 text-xs">
                    Không tìm thấy nhân viên nào khớp bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                vm.staffPagination.items.map((st) => {
                  const normalizedRole = st.role;
                  const isTargetAdmin = normalizedRole === "ADMIN";
                  const isTargetCeo = normalizedRole === "CEO";
                  const isTargetHighPriv = isTargetAdmin || isTargetCeo;
                  const startStr = toIsoDateSlice(st.contractStartDate);
                  const endStr = toIsoDateSlice(st.contractEndDate);
                  const displayAddr =
                    st.currentAddress || st.permanentAddress || st.address || "";
                  const activeContractNo =
                    st.officialContractNumber ||
                    st.probationContractNumber ||
                    st.internContractNumber ||
                    "";

                  return (
                    <tr key={st._id} className="hover:bg-slate-50">
                      <td className="py-3 px-3.5 font-mono font-bold">
                        {st.code || st._id.slice(-5)}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900">{st.fullName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          @{st.username} • {st.phone || "Chưa có SĐT"}
                        </div>
                        {st.bankAccount && (
                          <div className="text-[11px] text-slate-600 font-mono">
                            <span className="text-slate-400">STK:</span> {st.bankAccount}
                          </div>
                        )}
                        {st.email && (
                          <div className="text-[11px] text-slate-500 font-mono">
                            <span className="text-slate-400">LH:</span> {st.email}
                          </div>
                        )}
                        {st.companyEmail && (
                          <div className="text-[11px] text-brand-ink font-mono">
                            <span className="text-slate-400">Cty:</span> {st.companyEmail}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-mono text-slate-800 font-semibold">
                          {st.citizenId || "Chưa có CCCD"}
                        </div>
                        {st.dateOfBirth && (
                          <div className="text-[11px] text-slate-500 font-mono">
                            NS: {toIsoDateSlice(st.dateOfBirth)}
                            {st.gender ? ` · ${st.gender}` : ""}
                          </div>
                        )}
                        <div
                          className="text-[11px] text-slate-400 max-w-[180px] truncate"
                          title={displayAddr}
                        >
                          {displayAddr || "Chưa cập nhật địa chỉ"}
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            st.department === "OFFICE"
                              ? "bg-indigo-50 text-brand-ink border border-indigo-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {st.department === "OFFICE" ? "Văn phòng" : "Bán hàng"}
                        </span>
                        {st.positionTitle && (
                          <div className="text-[11px] text-slate-600 font-semibold mt-1">
                            {st.positionTitle}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        {isTargetCeo && !isCeo ? (
                          <span className="px-2.5 py-1 rounded bg-amber-50 border border-amber-300 font-mono font-bold text-xs text-amber-800">
                            CEO (Giám đốc)
                          </span>
                        ) : !isAdminView && !isCeo && isTargetHighPriv ? (
                          <span className="px-2.5 py-1 rounded bg-teal-50 border border-teal-200 font-mono font-bold text-xs text-brand-ink">
                            {isTargetCeo ? "CEO (Giám đốc)" : "ADMIN (Quản lý)"}
                          </span>
                        ) : (
                          <select
                            value={normalizedRole}
                            onChange={(e) => {
                              const nextRole = e.target.value as UserRole;
                              handleUpdateStaff(st, {
                                role: nextRole,
                                department: nextRole === "SALES" ? "SALES" : "OFFICE",
                              });
                            }}
                            className="px-2 py-1 rounded border border-slate-300 bg-white font-bold text-xs"
                          >
                            <option value="SALES">SALES (Nhân viên bán hàng)</option>
                            <option value="HR">HR (Nhân sự &amp; Chấm công)</option>
                            <option value="ACCOUNTANT">ACCOUNTANT (Kế toán &amp; Kho)</option>
                            <option value="MARKETING">MARKETING (Content Marketing)</option>
                            {(isAdminView || isCeo) && <option value="ADMIN">ADMIN (Quản lý)</option>}
                            {isCeo && <option value="CEO">CEO (Giám đốc - Toàn quyền)</option>}
                          </select>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="text-slate-800 font-bold">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] ${
                              st.contractType === "FULLTIME"
                                ? "bg-teal-50 text-brand-ink"
                                : st.contractType === "INTERN"
                                  ? "bg-teal-50 text-brand-ink"
                                  : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {contractTypeLabel(st.contractType)}
                          </span>
                        </div>
                        {activeContractNo && (
                          <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                            Số HĐ: {activeContractNo}
                          </div>
                        )}
                        {(startStr || endStr) && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {startStr || "?"} → {endStr || "Không TH"}
                          </div>
                        )}
                        <div className="mt-1.5">
                          {st.contractFileUrl ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 text-brand-ink border border-teal-200 text-[11px] font-bold">
                              Đã có file HĐ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-semibold">
                              Chưa có file HĐ
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            st.status === "ACTIVE"
                              ? "bg-teal-100 text-brand-ink"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {st.status === "ACTIVE" ? "Đang hoạt động" : "Đã khóa"}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {(() => {
                            const canEditProfile = isCeo || !isAdminView;
                            const canResetPwd = isCeo
                              ? true
                              : isAdminView
                                ? !isTargetCeo
                                : !isTargetHighPriv;
                            const canToggleLock = isCeo
                              ? true
                              : isAdminView
                                ? !isTargetCeo
                                : !isTargetHighPriv;

                            if (!canEditProfile && !canResetPwd && !canToggleLock) {
                              return (
                                <span className="text-[11px] text-slate-400 italic">
                                  {isTargetCeo ? "Tài khoản Giám đốc" : "Tài khoản Quản lý"}
                                </span>
                              );
                            }

                            return (
                              <>
                                {canEditProfile && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenProfileModal(st)}
                                    className="py-1.5 px-3 rounded-lg bg-teal-50 hover:bg-teal-100 text-brand-ink border border-teal-200 font-bold text-xs transition cursor-pointer"
                                  >
                                    Sửa hồ sơ
                                  </button>
                                )}
                                {canResetPwd && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenResetPassword(st)}
                                    className="px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-brand-ink border border-indigo-200 cursor-pointer"
                                  >
                                    <KeyRound className="w-3.5 h-3.5" /> Đổi mật khẩu
                                  </button>
                                )}
                                {canToggleLock && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateStaff(st, {
                                        status: st.status === "ACTIVE" ? "LOCKED" : "ACTIVE",
                                      })
                                    }
                                    className={`px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 cursor-pointer ${
                                      st.status === "ACTIVE"
                                        ? "bg-red-50 hover:bg-red-100 text-red-600"
                                        : "bg-teal-50 hover:bg-teal-100 text-brand-ink"
                                    }`}
                                  >
                                    {st.status === "ACTIVE" ? (
                                      <>
                                        <Lock className="w-3.5 h-3.5" /> Khóa TK
                                      </>
                                    ) : (
                                      <>
                                        <Unlock className="w-3.5 h-3.5" /> Mở khóa
                                      </>
                                    )}
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar
          totalItems={vm.staffPagination.total}
          page={vm.staffPagination.page}
          totalPages={vm.staffPagination.totalPages}
          pageSize={vm.staffPagination.pageSize}
          onPageChange={vm.staffPagination.setPage}
          onPageSizeChange={vm.staffPagination.setPageSize}
          itemLabel="nhân sự"
        />
      </div>

    </>
  );
}
