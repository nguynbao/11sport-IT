import { apiRequest } from "@/shared/api/client";
import { ParsedStaffImportRow } from "@/shared/types";
import { parseStaffImportFileApi } from "../api";
import { API_ENDPOINTS } from "@/shared/api/endpoints";

export function buildStaffImportActions(ctx: any) {
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
    readFileAsDataUrl,
    setBulkPassword,
    importFileName,
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

  const fillCreateFormFromImportRow = (row: ParsedStaffImportRow, customUsername?: string) => {
    setUsername((customUsername || row.suggestedUsername || "").trim());
    setFullName(row.fullName || "");
    setPhone(row.phone || "");
    setEmail(row.email || "");
    setCompanyEmail(row.companyEmail || "");
    setDateOfBirth(row.dateOfBirth || "");
    setGender(row.gender || "");
    setNationality(row.nationality || "Việt Nam");
    setCitizenId(row.citizenId || "");
    setCitizenIssueDate(row.citizenIssueDate || "");
    setCitizenIssuePlace(row.citizenIssuePlace || "");
    setPermanentAddress(row.permanentAddress || "");
    setCurrentAddress(row.currentAddress || "");
    setSchool(row.school || "");
    setMajor(row.major || "");
    setPositionTitle(row.positionTitle || "");
    setBankAccount(row.bankAccount || "");
    setRole(row.role || "SALES");
    setDepartment(row.department || (row.role === "SALES" ? "SALES" : "OFFICE"));
    setContractType(row.contractType || "PROBATION");
    setContractStartDate(row.contractStartDate || "");
    setContractEndDate(row.contractEndDate || "");
    setInternContractNumber(row.internContractNumber || "");
    setProbationContractNumber(row.probationContractNumber || "");
    setOfficialContractNumber(row.officialContractNumber || "");
    setBhxhStartDate(row.bhxhStartDate || "");
    setBhxhEndDate(row.bhxhEndDate || "");
    setRecordedLeaveDays(row.recordedLeaveDays ? String(row.recordedLeaveDays) : "0");
    setBaseSalary(row.baseSalary ? String(row.baseSalary) : "");
    setAllowance(row.allowance ? String(row.allowance) : "");
    setBonus(row.bonus ? String(row.bonus) : "");
    setInsurance(row.insurance ? String(row.insurance) : "");
    setShowExtendedCreate(true);
  };

  const handleImportStaffExcel = async (file?: File) => {
    if (!file) return;
    setStatusMsg(null);
    setImportModalError(null);
    setImportingExcel(true);
    try {
      const dataUrl = await readFileAsDataUrl(file, 10);
      const rows = await parseStaffImportFileApi({
        fileName: file.name,
        fileBase64: dataUrl,
      });

      if (!rows || rows.length === 0) {
        setStatusMsg({
          type: "error",
          text: "Không tìm thấy dòng hồ sơ nhân sự hợp lệ trong file đã chọn.",
        });
        return;
      }

      if (rows.length === 1) {
        fillCreateFormFromImportRow(rows[0]);
        setStatusMsg({
          type: "success",
          text: `Đã tự động điền toàn bộ hồ sơ của "${rows[0].fullName}" (username gợi ý: @${rows[0].suggestedUsername}) từ file "${file.name}". Kiểm tra lại và bấm "+ Tạo Nhân Viên Mới"!`,
        });
      } else {
        setImportFileName(file.name);
        setBulkPassword(password || "123456");
        setImportRows(
          rows.map((r) => ({
            ...r,
            selected: true,
            usernameInput: r.suggestedUsername,
          }))
        );
        setImportModalOpen(true);
      }
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể đọc file Excel/CSV hồ sơ nhân sự.",
      });
    } finally {
      setImportingExcel(false);
    }
  };

  const handleBulkCreateFromModal = async () => {
    const selected = importRows.filter((r: any) => r.selected);
    if (selected.length === 0) {
      setImportModalError("Vui lòng tích chọn ít nhất 1 nhân viên để tạo tài khoản.");
      return;
    }
    const cleanPwd = bulkPassword.trim() || "123456";
    if (cleanPwd.length < 4) {
      setImportModalError("Mật khẩu khởi tạo phải có ít nhất 4 ký tự.");
      return;
    }

    setBulkCreating(true);
    setImportModalError(null);
    let createdCount = 0;
    const failedMessages: string[] = [];
    const createdRowIndices = new Set<number>();

    for (const row of selected) {
      const uname = row.usernameInput.trim().toLowerCase();
      if (!uname) {
        failedMessages.push(`Dòng ${row.rowIndex} (${row.fullName}): Thiếu username`);
        continue;
      }
      try {
        await apiRequest(API_ENDPOINTS.STAFF.BASE, {
          method: "POST",
          body: JSON.stringify({
            username: uname,
            password: cleanPwd,
            fullName: row.fullName,
            phone: row.phone,
            email: row.email,
            companyEmail: row.companyEmail,
            dateOfBirth: row.dateOfBirth || undefined,
            gender: row.gender,
            nationality: row.nationality || "Việt Nam",
            citizenId: row.citizenId,
            citizenIssueDate: row.citizenIssueDate || undefined,
            citizenIssuePlace: row.citizenIssuePlace,
            permanentAddress: row.permanentAddress,
            currentAddress: row.currentAddress,
            address: row.permanentAddress || row.currentAddress,
            school: row.school,
            major: row.major,
            positionTitle: row.positionTitle,
            bankAccount: row.bankAccount,
            role: row.role,
            department: row.department,
            contractType: row.contractType,
            contractStartDate: row.contractStartDate || undefined,
            contractEndDate: row.contractEndDate || undefined,
            internContractNumber: row.internContractNumber,
            probationContractNumber: row.probationContractNumber,
            officialContractNumber: row.officialContractNumber,
            bhxhStartDate: row.bhxhStartDate || undefined,
            bhxhEndDate: row.bhxhEndDate || undefined,
            recordedLeaveDays: row.recordedLeaveDays || 0,
            baseSalary: row.baseSalary || 0,
            allowance: row.allowance || 0,
            bonus: row.bonus || 0,
            insurance: row.insurance || 0,
          }),
        });
        createdCount++;
        createdRowIndices.add(row.rowIndex);
      } catch (err: any) {
        failedMessages.push(
          `Dòng ${row.rowIndex} (${row.fullName}): ${err?.message || "Lỗi tạo tài khoản"}`
        );
      }
    }

    await loadStaff();
    setBulkCreating(false);

    if (failedMessages.length === 0) {
      setImportModalOpen(false);
      setImportRows([]);
      setStatusMsg({
        type: "success",
        text: `Đã tạo hàng loạt thành công ${createdCount} tài khoản & hồ sơ nhân sự từ file "${importFileName}"!`,
      });
    } else {
      setImportRows((prev: any) => prev.filter((r: any) => !createdRowIndices.has(r.rowIndex)));
      setImportModalError(
        `Đã tạo ${createdCount}/${selected.length} nhân sự. Lỗi (${failedMessages.length}): ${failedMessages.join(" | ")}`
      );
    }
  };


  return {
    fillCreateFormFromImportRow,
    handleImportStaffExcel,
    handleBulkCreateFromModal,
  };
}
