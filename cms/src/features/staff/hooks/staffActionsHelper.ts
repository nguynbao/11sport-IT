import type React from "react";
import { apiRequest } from "@/shared/api/client";
import type { ContractType, StaffUser, UserRole } from "@/shared/types";
import { formatMoneyInput, parseMoneyInput, toIsoDateSlice } from "../utils";

export function buildStaffActions(ctx: any) {
  const {
    isCeo,
    isAdminView,
    staffList,
    username,
    setUsername,
    password,
    setPassword,
    fullName,
    setFullName,
    phone,
    setPhone,
    email,
    setEmail,
    companyEmail,
    setCompanyEmail,
    dateOfBirth,
    setDateOfBirth,
    gender,
    setGender,
    nationality,
    setNationality,
    citizenId,
    setCitizenId,
    citizenIssueDate,
    setCitizenIssueDate,
    citizenIssuePlace,
    setCitizenIssuePlace,
    permanentAddress,
    setPermanentAddress,
    currentAddress,
    setCurrentAddress,
    school,
    setSchool,
    major,
    setMajor,
    positionTitle,
    setPositionTitle,
    bankAccount,
    setBankAccount,
    role,
    setRole,
    department,
    setDepartment,
    contractType,
    setContractType,
    contractStartDate,
    setContractStartDate,
    contractEndDate,
    setContractEndDate,
    internContractNumber,
    setInternContractNumber,
    probationContractNumber,
    setProbationContractNumber,
    officialContractNumber,
    setOfficialContractNumber,
    bhxhStartDate,
    setBhxhStartDate,
    bhxhEndDate,
    setBhxhEndDate,
    recordedLeaveDays,
    setRecordedLeaveDays,
    contractFileUrl,
    setContractFileUrl,
    contractFileName,
    setContractFileName,
    baseSalary,
    setBaseSalary,
    allowance,
    setAllowance,
    bonus,
    setBonus,
    insurance,
    setInsurance,
    setShowExtendedCreate,
    setImportingExcel,
    setImportModalOpen,
    setImportFileName,
    importRows,
    setImportRows,
    bulkPassword,
    setBulkCreating,
    setImportModalError,
    pwdTargetStaff,
    setPwdTargetStaff,
    newStaffPassword,
    setNewStaffPassword,
    confirmStaffPassword,
    setConfirmStaffPassword,
    setPwdSaving,
    selectedStaffProfile,
    setSelectedStaffProfile,
    editFullName,
    setEditFullName,
    editPhone,
    setEditPhone,
    editEmail,
    setEditEmail,
    editCompanyEmail,
    setEditCompanyEmail,
    editDateOfBirth,
    setEditDateOfBirth,
    editGender,
    setEditGender,
    editNationality,
    setEditNationality,
    editCitizenId,
    setEditCitizenId,
    editCitizenIssueDate,
    setEditCitizenIssueDate,
    editCitizenIssuePlace,
    setEditCitizenIssuePlace,
    editPermanentAddress,
    setEditPermanentAddress,
    editCurrentAddress,
    setEditCurrentAddress,
    editSchool,
    setEditSchool,
    editMajor,
    setEditMajor,
    editPositionTitle,
    setEditPositionTitle,
    editBankAccount,
    setEditBankAccount,
    editDepartment,
    setEditDepartment,
    editContractType,
    setEditContractType,
    editProbationMonths,
    setEditProbationMonths,
    editContractStart,
    setEditContractStart,
    editContractEnd,
    setEditContractEnd,
    editInternContractNo,
    setEditInternContractNo,
    editProbationContractNo,
    setEditProbationContractNo,
    editOfficialContractNo,
    setEditOfficialContractNo,
    editBhxhStart,
    setEditBhxhStart,
    editBhxhEnd,
    setEditBhxhEnd,
    editRecordedLeaveDays,
    setEditRecordedLeaveDays,
    editContractFileUrl,
    setEditContractFileUrl,
    editContractFileName,
    setEditContractFileName,
    editBaseSalary,
    setEditBaseSalary,
    editAllowance,
    setEditAllowance,
    editBonus,
    setEditBonus,
    editInsurance,
    setEditInsurance,
    setProfileSaving,
    setStatusMsg,
    loadStaff,
    resetCreateForm,
  } = ctx;

  const handleOpenProfileModal = (st: StaffUser) => {
    setSelectedStaffProfile(st);
    setEditFullName(st.fullName || "");
    setEditPhone(st.phone || "");
    setEditEmail(st.email || "");
    setEditCompanyEmail(st.companyEmail || "");
    setEditDateOfBirth(toIsoDateSlice(st.dateOfBirth));
    setEditGender(st.gender || "");
    setEditNationality(st.nationality || "Việt Nam");
    setEditCitizenId(st.citizenId || "");
    setEditCitizenIssueDate(toIsoDateSlice(st.citizenIssueDate));
    setEditCitizenIssuePlace(st.citizenIssuePlace || "");
    setEditPermanentAddress(st.permanentAddress || st.address || "");
    setEditCurrentAddress(st.currentAddress || "");
    setEditSchool(st.school || "");
    setEditMajor(st.major || "");
    setEditPositionTitle(st.positionTitle || "");
    setEditBankAccount(st.bankAccount || "");
    setEditDepartment(st.department === "OFFICE" ? "OFFICE" : "SALES");
    setEditContractType(st.contractType || "PROBATION");
    setEditProbationMonths(
      st.probationMonths !== undefined &&
        st.probationMonths !== null &&
        !(st.contractType === "PROBATION" && Number(st.probationMonths) === 0)
        ? Math.min(2, Math.max(0, Number(st.probationMonths)))
        : st.contractType === "PROBATION"
          ? 2
          : 0
    );
    setEditContractStart(toIsoDateSlice(st.contractStartDate));
    setEditContractEnd(toIsoDateSlice(st.contractEndDate));
    setEditInternContractNo(st.internContractNumber || "");
    setEditProbationContractNo(st.probationContractNumber || "");
    setEditOfficialContractNo(st.officialContractNumber || "");
    setEditBhxhStart(toIsoDateSlice(st.bhxhStartDate));
    setEditBhxhEnd(toIsoDateSlice(st.bhxhEndDate));
    setEditRecordedLeaveDays(String(Number(st.recordedLeaveDays || 0)));
    setEditContractFileUrl(st.contractFileUrl || "");
    setEditContractFileName(st.contractFileName || "");
    setEditBaseSalary(Number(st.baseSalary || 0));
    setEditAllowance(Number(st.allowance || 0));
    setEditBonus(Number(st.bonus || 0));
    setEditInsurance(Number(st.insurance || 0));
  };

  const handleSaveProfileModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffProfile) return;
    setProfileSaving(true);
    setStatusMsg(null);
    try {
      const cleanPerm = editPermanentAddress.trim();
      const cleanCurr = editCurrentAddress.trim();
      await apiRequest(`/staff/${selectedStaffProfile._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: editFullName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim(),
          companyEmail: editCompanyEmail.trim(),
          dateOfBirth: editDateOfBirth || null,
          gender: editGender.trim(),
          nationality: editNationality.trim(),
          citizenId: editCitizenId.trim(),
          citizenIssueDate: editCitizenIssueDate || null,
          citizenIssuePlace: editCitizenIssuePlace.trim(),
          permanentAddress: cleanPerm,
          currentAddress: cleanCurr,
          address: cleanPerm || cleanCurr,
          school: editSchool.trim(),
          major: editMajor.trim(),
          positionTitle: editPositionTitle.trim(),
          bankAccount: editBankAccount.trim(),
          department: editDepartment,
          contractType: editContractType,
          probationMonths:
            editContractType === "INTERN"
              ? 0
              : Math.min(2, Math.max(0, Number(editProbationMonths) || 0)),
          contractStartDate: editContractStart || null,
          contractEndDate: editContractEnd || null,
          internContractNumber: editInternContractNo.trim(),
          probationContractNumber: editProbationContractNo.trim(),
          officialContractNumber: editOfficialContractNo.trim(),
          bhxhStartDate: editBhxhStart || null,
          bhxhEndDate: editBhxhEnd || null,
          recordedLeaveDays: Math.max(0, Number(editRecordedLeaveDays) || 0),
          contractFileUrl: editContractFileUrl,
          contractFileName: editContractFileName,
          baseSalary: Math.max(0, Number(editBaseSalary) || 0),
          allowance: Math.max(0, Number(editAllowance) || 0),
          bonus: Math.max(0, Number(editBonus) || 0),
          insurance: Math.max(0, Number(editInsurance) || 0),
        }),
      });
      setStatusMsg({
        type: "success",
        text: `Đã lưu cập nhật hồ sơ & chế độ lương của "${editFullName.trim()}" thành công!`,
      });
      setSelectedStaffProfile(null);
      loadStaff();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể lưu hồ sơ nhân sự.",
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    if (!username.trim()) return;
    if (!isAdminView && !fullName.trim()) return;
    if (!isAdminView && !contractType) {
      setStatusMsg({
        type: "error",
        text: "Vui lòng chọn Loại hợp đồng (Thực tập / Thử việc / Chính thức).",
      });
      return;
    }
    try {
      const targetFullName = fullName.trim() || username.trim();
      const cleanPerm = permanentAddress.trim();
      const cleanCurr = currentAddress.trim();
      const payload: Record<string, any> = {
        username: username.trim(),
        password: password || "123456",
        fullName: targetFullName,
        phone: phone.trim(),
        email: email.trim(),
        companyEmail: companyEmail.trim(),
        citizenId: citizenId.trim(),
        role,
        department: role === "SALES" ? "SALES" : department || "OFFICE",
        contractType: contractType || undefined,
        contractFileUrl,
        contractFileName,
      };
      if (!isAdminView) {
        payload.dateOfBirth = dateOfBirth || undefined;
        payload.gender = gender.trim();
        payload.nationality = nationality.trim();
        payload.citizenIssueDate = citizenIssueDate || undefined;
        payload.citizenIssuePlace = citizenIssuePlace.trim();
        payload.permanentAddress = cleanPerm;
        payload.currentAddress = cleanCurr;
        payload.address = cleanPerm || cleanCurr;
        payload.school = school.trim();
        payload.major = major.trim();
        payload.positionTitle = positionTitle.trim();
        payload.bankAccount = bankAccount.trim();
        payload.contractStartDate = contractStartDate || undefined;
        payload.contractEndDate = contractEndDate || undefined;
        payload.internContractNumber = internContractNumber.trim();
        payload.probationContractNumber = probationContractNumber.trim();
        payload.officialContractNumber = officialContractNumber.trim();
        payload.bhxhStartDate = bhxhStartDate || undefined;
        payload.bhxhEndDate = bhxhEndDate || undefined;
        payload.recordedLeaveDays = recordedLeaveDays !== "" ? Math.max(0, Number(recordedLeaveDays) || 0) : 0;
        payload.baseSalary = parseMoneyInput(baseSalary);
        payload.allowance = parseMoneyInput(allowance);
        payload.bonus = parseMoneyInput(bonus);
        payload.insurance = parseMoneyInput(insurance);
      }
      await apiRequest("/staff", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      resetCreateForm();
      setStatusMsg({
        type: "success",
        text: `Đã tạo tài khoản nhân viên "${targetFullName}" thành công!`,
      });
      loadStaff();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể tạo nhân viên mới.",
      });
    }
  };

  const handleUpdateStaff = async (
    staff: StaffUser,
    updates: {
      role?: UserRole;
      department?: "OFFICE" | "SALES";
      status?: "ACTIVE" | "LOCKED";
      fullName?: string;
      password?: string;
    }
  ) => {
    setStatusMsg(null);
    try {
      await apiRequest(`/staff/${staff._id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      setStatusMsg({
        type: "success",
        text: `Đã cập nhật nhân viên "${staff.fullName}" thành công!`,
      });
      loadStaff();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Lỗi khi cập nhật nhân viên.",
      });
    }
  };

  const handleOpenResetPassword = (staff: StaffUser) => {
    setPwdTargetStaff(staff);
    setNewStaffPassword("");
    setConfirmStaffPassword("");
    setStatusMsg(null);
  };

  const handleResetStaffPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdTargetStaff) return;
    setStatusMsg(null);
    const cleanPwd = newStaffPassword.trim();
    if (cleanPwd.length < 4) {
      setStatusMsg({
        type: "error",
        text: "Mật khẩu mới phải có ít nhất 4 ký tự.",
      });
      return;
    }
    if (cleanPwd !== confirmStaffPassword.trim()) {
      setStatusMsg({
        type: "error",
        text: "Xác nhận mật khẩu mới không khớp.",
      });
      return;
    }

    setPwdSaving(true);
    try {
      await apiRequest(`/staff/${pwdTargetStaff._id}`, {
        method: "PATCH",
        body: JSON.stringify({ password: cleanPwd }),
      });
      setStatusMsg({
        type: "success",
        text: `Đã đổi mật khẩu cho tài khoản "${pwdTargetStaff.username}" (${pwdTargetStaff.fullName}) thành công!`,
      });
      setPwdTargetStaff(null);
      setNewStaffPassword("");
      setConfirmStaffPassword("");
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể đổi mật khẩu cho tài khoản này.",
      });
    } finally {
      setPwdSaving(false);
    }
  };


  return {
    handleOpenProfileModal,
    handleSaveProfileModal,
    handleCreateStaff,
    handleUpdateStaff,
    handleOpenResetPassword,
    handleResetStaffPassword,
  };
}
