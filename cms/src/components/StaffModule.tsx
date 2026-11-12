"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  StaffUser,
  UserRole,
  apiRequest,
  ContractType,
  CONTRACT_TYPE_OPTIONS,
  contractTypeLabel,
  formatVND,
  ParsedStaffImportRow,
  parseStaffImportFileApi,
} from "@/lib/api";
import ExportExcelButton from "./ExportExcelButton";
import { exportStaff, downloadStaffImportTemplate } from "@/lib/exports";
import {
  Users,
  UserPlus,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  X,
  Save,
  Upload,
  FileText,
  Trash2,
  Eye,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  FileSpreadsheet,
  Download,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Loader2,
} from "lucide-react";
import ContractFilePreviewModal from "./ContractFilePreviewModal";

/** Định dạng số nguyên thành chuỗi có dấu chấm phân cách hàng nghìn (VD: 10000 -> "10.000", 0 -> "") */
function formatMoneyInput(val: number | string | undefined | null): string {
  const digits = String(val ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("vi-VN");
}

/** Chuyển chuỗi có dấu chấm phân cách về số nguyên không âm */
function parseMoneyInput(raw: string): number {
  const digits = String(raw || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return 0;
  return Number(digits) || 0;
}

function toIsoDateSlice(val?: string | null): string {
  if (!val) return "";
  return String(val).slice(0, 10);
}

interface EditableImportRow extends ParsedStaffImportRow {
  selected: boolean;
  usernameInput: string;
}

export default function StaffModule({
  mode = "HR_FULL",
}: {
  mode?: "ADMIN_LOCK_ONLY" | "HR_FULL";
}) {
  const isAdminView = mode === "ADMIN_LOCK_ONLY";
  const [staffList, setStaffList] = useState<StaffUser[]>([]);

  // --- Form Tạo Tài Khoản Nhân Viên Mới ---
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("123456");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("Việt Nam");
  const [citizenId, setCitizenId] = useState("");
  const [citizenIssueDate, setCitizenIssueDate] = useState("");
  const [citizenIssuePlace, setCitizenIssuePlace] = useState("");
  const [permanentAddress, setPermanentAddress] = useState("");
  const [currentAddress, setCurrentAddress] = useState("");
  const [school, setSchool] = useState("");
  const [major, setMajor] = useState("");
  const [positionTitle, setPositionTitle] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [role, setRole] = useState<UserRole>("SALES");
  const [department, setDepartment] = useState<"OFFICE" | "SALES">("SALES");
  // Bắt buộc HR chọn loại hợp đồng khi tạo tài khoản (không có mặc định)
  const [contractType, setContractType] = useState<ContractType | "">("");
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");
  const [internContractNumber, setInternContractNumber] = useState("");
  const [probationContractNumber, setProbationContractNumber] = useState("");
  const [officialContractNumber, setOfficialContractNumber] = useState("");
  const [bhxhStartDate, setBhxhStartDate] = useState("");
  const [bhxhEndDate, setBhxhEndDate] = useState("");
  const [recordedLeaveDays, setRecordedLeaveDays] = useState<string>("");
  const [contractFileUrl, setContractFileUrl] = useState("");
  const [contractFileName, setContractFileName] = useState("");
  const [baseSalary, setBaseSalary] = useState<string>("");
  const [allowance, setAllowance] = useState<string>("");
  const [bonus, setBonus] = useState<string>("");
  const [insurance, setInsurance] = useState<string>("");
  const [showExtendedCreate, setShowExtendedCreate] = useState<boolean>(true);

  // --- Import nhanh từ Excel / CSV ---
  const [importingExcel, setImportingExcel] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importRows, setImportRows] = useState<EditableImportRow[]>([]);
  const [bulkPassword, setBulkPassword] = useState("123456");
  const [bulkCreating, setBulkCreating] = useState(false);
  const [importModalError, setImportModalError] = useState<string | null>(null);

  // Bộ lọc & sắp xếp Danh sách Nhân viên
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDept, setFilterDept] = useState<"ALL" | "OFFICE" | "SALES">("ALL");
  const [filterRole, setFilterRole] = useState<"ALL" | UserRole>("ALL");
  const [filterContract, setFilterContract] = useState<"ALL" | ContractType>("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "LOCKED">("ALL");
  const [sortBy, setSortBy] = useState<
    "code" | "fullName" | "baseSalary" | "allowance" | "bonus" | "insurance" | "createdAt"
  >("code");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Modal đổi mật khẩu cho nhân viên
  const [pwdTargetStaff, setPwdTargetStaff] = useState<StaffUser | null>(null);
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [confirmStaffPassword, setConfirmStaffPassword] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

  // Modal xem & chỉnh sửa chi tiết hồ sơ nhân sự (Dành cho HR)
  const [selectedStaffProfile, setSelectedStaffProfile] = useState<StaffUser | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCompanyEmail, setEditCompanyEmail] = useState("");
  const [editDateOfBirth, setEditDateOfBirth] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editNationality, setEditNationality] = useState("");
  const [editCitizenId, setEditCitizenId] = useState("");
  const [editCitizenIssueDate, setEditCitizenIssueDate] = useState("");
  const [editCitizenIssuePlace, setEditCitizenIssuePlace] = useState("");
  const [editPermanentAddress, setEditPermanentAddress] = useState("");
  const [editCurrentAddress, setEditCurrentAddress] = useState("");
  const [editSchool, setEditSchool] = useState("");
  const [editMajor, setEditMajor] = useState("");
  const [editPositionTitle, setEditPositionTitle] = useState("");
  const [editBankAccount, setEditBankAccount] = useState("");
  const [editDepartment, setEditDepartment] = useState<"OFFICE" | "SALES">("SALES");
  const [editContractType, setEditContractType] = useState<ContractType>("PROBATION");
  const [editProbationMonths, setEditProbationMonths] = useState<number>(2);
  const [editContractStart, setEditContractStart] = useState("");
  const [editContractEnd, setEditContractEnd] = useState("");
  const [editInternContractNo, setEditInternContractNo] = useState("");
  const [editProbationContractNo, setEditProbationContractNo] = useState("");
  const [editOfficialContractNo, setEditOfficialContractNo] = useState("");
  const [editBhxhStart, setEditBhxhStart] = useState("");
  const [editBhxhEnd, setEditBhxhEnd] = useState("");
  const [editRecordedLeaveDays, setEditRecordedLeaveDays] = useState<string>("0");
  const [editContractFileUrl, setEditContractFileUrl] = useState("");
  const [editContractFileName, setEditContractFileName] = useState("");
  const [editBaseSalary, setEditBaseSalary] = useState<number>(0);
  const [editAllowance, setEditAllowance] = useState<number>(0);
  const [editBonus, setEditBonus] = useState<number>(0);
  const [editInsurance, setEditInsurance] = useState<number>(0);
  const [profileSaving, setProfileSaving] = useState(false);

  // Modal xem trước file hợp đồng
  const [previewContractStaff, setPreviewContractStaff] = useState<{
    fullName: string;
    fileName: string;
    fileUrl: string;
  } | null>(null);

  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadStaff = async () => {
    try {
      const res = await apiRequest<StaffUser[]>("/staff");
      setStaffList(Array.isArray(res.data) ? res.data : []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const readFileAsDataUrl = (file: File, maxMb = 8): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.size > maxMb * 1024 * 1024) {
        reject(new Error(`Dung lượng file tối đa ${maxMb}MB.`));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Không thể đọc file."));
      reader.readAsDataURL(file);
    });
  };

  const resetCreateForm = () => {
    setUsername("");
    setContractType("");
    setFullName("");
    setPhone("");
    setEmail("");
    setCompanyEmail("");
    setDateOfBirth("");
    setGender("");
    setNationality("Việt Nam");
    setCitizenId("");
    setCitizenIssueDate("");
    setCitizenIssuePlace("");
    setPermanentAddress("");
    setCurrentAddress("");
    setSchool("");
    setMajor("");
    setPositionTitle("");
    setBankAccount("");
    setContractStartDate("");
    setContractEndDate("");
    setInternContractNumber("");
    setProbationContractNumber("");
    setOfficialContractNumber("");
    setBhxhStartDate("");
    setBhxhEndDate("");
    setRecordedLeaveDays("");
    setContractFileUrl("");
    setContractFileName("");
    setBaseSalary("");
    setAllowance("");
    setBonus("");
    setInsurance("");
  };

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
    const selected = importRows.filter((r) => r.selected);
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
        await apiRequest("/staff", {
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
      setImportRows((prev) => prev.filter((r) => !createdRowIndices.has(r.rowIndex)));
      setImportModalError(
        `Đã tạo ${createdCount}/${selected.length} nhân sự. Lỗi (${failedMessages.length}): ${failedMessages.join(" | ")}`
      );
    }
  };

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

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    filterDept !== "ALL" ||
    filterRole !== "ALL" ||
    filterContract !== "ALL" ||
    filterStatus !== "ALL" ||
    sortBy !== "code" ||
    sortOrder !== "asc";

  const handleResetFilters = () => {
    setSearchQuery("");
    setFilterDept("ALL");
    setFilterRole("ALL");
    setFilterContract("ALL");
    setFilterStatus("ALL");
    setSortBy("code");
    setSortOrder("asc");
  };

  const handleColumnSort = (
    field: "code" | "fullName" | "baseSalary" | "allowance" | "bonus" | "insurance" | "createdAt"
  ) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder(
        ["baseSalary", "allowance", "bonus", "insurance"].includes(field) ? "desc" : "asc"
      );
    }
  };

  const filteredStaffList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = staffList.filter((st) => {
      const normalizedRole = st.role === ("WAREHOUSE" as any) ? "ACCOUNTANT" : st.role;
      const dept = st.department || (normalizedRole === "SALES" ? "SALES" : "OFFICE");
      if (filterDept !== "ALL" && dept !== filterDept) return false;
      if (filterRole !== "ALL" && normalizedRole !== filterRole) return false;
      if (filterContract !== "ALL" && (st.contractType || "PROBATION") !== filterContract) {
        return false;
      }
      if (filterStatus !== "ALL" && st.status !== filterStatus) return false;
      if (q) {
        const hay = [
          st.code,
          st.fullName,
          st.username,
          st.phone,
          st.email,
          st.companyEmail,
          st.citizenId,
          st.address,
          st.permanentAddress,
          st.currentAddress,
          st.positionTitle,
          st.school,
          st.major,
          st.bankAccount,
          st.internContractNumber,
          st.probationContractNumber,
          st.officialContractNumber,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const dir = sortOrder === "desc" ? -1 : 1;
    return [...filtered].sort((a, b) => {
      if (["baseSalary", "allowance", "bonus", "insurance"].includes(sortBy)) {
        const va = Number((a as any)[sortBy] || 0);
        const vb = Number((b as any)[sortBy] || 0);
        return (va - vb) * dir;
      }
      if (sortBy === "createdAt") {
        const ta = new Date(a.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || 0).getTime();
        return (ta - tb) * dir;
      }
      if (sortBy === "fullName") {
        return (a.fullName || "").localeCompare(b.fullName || "", "vi") * dir;
      }
      return (a.code || "").localeCompare(b.code || "", "vi") * dir;
    });
  }, [staffList, searchQuery, filterDept, filterRole, filterContract, filterStatus, sortBy, sortOrder]);

  const allModalSelected =
    importRows.length > 0 && importRows.every((r) => r.selected);
  const selectedModalCount = importRows.filter((r) => r.selected).length;

  return (
    <div className="space-y-6">
      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            statusMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {statusMsg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Form Tạo Tài Khoản:
          - Admin (isAdminView): Tạo nhanh với Tên đăng nhập, Mật khẩu, Cấp Role (bao gồm ADMIN)
          - HR (!isAdminView): Tạo tài khoản kèm đầy đủ thông tin nhân sự + nút Import nhanh từ Excel */}
      <form
        onSubmit={handleCreateStaff}
        className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-emerald-600" />
            {isAdminView
              ? "Tạo Tài Khoản Mới & Cấp Quyền (Admin)"
              : "Thêm Tài khoản Nhân viên Mới & Hồ sơ Nhân sự (HR)"}
          </h3>

          {!isAdminView && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={downloadStaffImportTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition cursor-pointer"
                title="Tải file mẫu chuẩn (2 dòng tiêu đề gộp ô) của HR"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Tải file mẫu</span>
              </button>

              <label
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition cursor-pointer ${
                  importingExcel ? "opacity-70 pointer-events-none" : ""
                }`}
                title="Chọn file Excel (.xlsx) hoặc CSV (.csv) để tự động điền các ô thông tin hoặc tạo hàng loạt"
              >
                {importingExcel ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                )}
                <span>
                  {importingExcel ? "Đang đọc file..." : "Import nhanh từ Excel (.xlsx / .csv)"}
                </span>
                <input
                  type="file"
                  accept=".xlsx,.csv,.tsv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportStaffExcel(f);
                    e.target.value = "";
                  }}
                />
              </label>

              <button
                type="button"
                onClick={resetCreateForm}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition cursor-pointer"
                title="Làm mới các ô đang nhập"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xóa form</span>
              </button>
            </div>
          )}
        </div>

        {isAdminView ? (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Tên đăng nhập *
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="VD: sales2, hr2..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Mật khẩu *
              </label>
              <input
                type="text"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Cấp Vai trò (Role) *
              </label>
              <select
                value={role}
                onChange={(e) => {
                  const nextRole = e.target.value as UserRole;
                  setRole(nextRole);
                  setDepartment(nextRole === "SALES" ? "SALES" : "OFFICE");
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-bold"
              >
                <option value="SALES">SALES (Bán hàng)</option>
                <option value="HR">HR (Nhân sự &amp; Chấm công)</option>
                <option value="ACCOUNTANT">ACCOUNTANT (Kế toán &amp; Kho)</option>
                <option value="MARKETING">MARKETING (Content Marketing)</option>
                <option value="ADMIN">ADMIN (Quản lý)</option>
              </select>
            </div>

            <div>
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition"
              >
                + Tạo Tài Khoản
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Hàng Tài khoản hệ thống: Username, Mật khẩu, Vai trò */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                1. Tài khoản Đăng nhập &amp; Phân quyền Hệ thống
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Tên đăng nhập *
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="VD: maunv (tự gợi ý khi import)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Mật khẩu *
                  </label>
                  <input
                    type="text"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Vai trò hệ thống *
                  </label>
                  <select
                    value={role === "ADMIN" ? "SALES" : role}
                    onChange={(e) => {
                      const nextRole = e.target.value as UserRole;
                      setRole(nextRole);
                      setDepartment(nextRole === "SALES" ? "SALES" : "OFFICE");
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-bold"
                  >
                    <option value="SALES">SALES (Bán hàng)</option>
                    <option value="HR">HR (Nhân sự &amp; Chấm công)</option>
                    <option value="ACCOUNTANT">ACCOUNTANT (Kế toán &amp; Kho)</option>
                    <option value="MARKETING">MARKETING (Content Marketing)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Khung 26 trường chuẩn theo đúng mẫu Import Nhân sự của HR */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">
                  2. Thông tin Hồ sơ Nhân sự theo Mẫu Chuẩn (BẮT ĐẦU → STK)
                </div>
                <button
                  type="button"
                  onClick={() => setShowExtendedCreate((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                >
                  {showExtendedCreate ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  <span>{showExtendedCreate ? "Thu gọn" : "Mở rộng đầy đủ"}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    BẮT ĐẦU
                  </label>
                  <input
                    type="date"
                    value={contractStartDate}
                    onChange={(e) => setContractStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    KẾT THÚC
                  </label>
                  <input
                    type="date"
                    value={contractEndDate}
                    onChange={(e) => setContractEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    HỌ TÊN *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="VD: Nguyễn Văn Mẫu"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    NGÀY SINH
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    GIỚI TÍNH
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                  >
                    <option value="">-- Chọn --</option>
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
              </div>

              {showExtendedCreate && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        QUỐC TỊCH
                      </label>
                      <input
                        type="text"
                        value={nationality}
                        onChange={(e) => setNationality(e.target.value)}
                        placeholder="Việt Nam"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        CMND / CCCD
                      </label>
                      <input
                        type="text"
                        value={citizenId}
                        onChange={(e) => setCitizenId(e.target.value)}
                        placeholder="VD: 048201001234"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        NGÀY CẤP
                      </label>
                      <input
                        type="date"
                        value={citizenIssueDate}
                        onChange={(e) => setCitizenIssueDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        NƠI CẤP
                      </label>
                      <input
                        type="text"
                        value={citizenIssuePlace}
                        onChange={(e) => setCitizenIssuePlace(e.target.value)}
                        placeholder="VD: Cục CS QLHC về TTXH"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        SDT
                      </label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="VD: 0905123456"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Email liên hệ
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="canhan@gmail.com"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Email công ty
                      </label>
                      <input
                        type="email"
                        value={companyEmail}
                        onChange={(e) => setCompanyEmail(e.target.value)}
                        placeholder="ten@11sport.vn"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        ĐỊA CHỈ THƯỜNG CHÚ
                      </label>
                      <input
                        type="text"
                        value={permanentAddress}
                        onChange={(e) => setPermanentAddress(e.target.value)}
                        placeholder="VD: Hải Châu, Đà Nẵng"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        ĐỊA CHỈ HIỆN TẠI
                      </label>
                      <input
                        type="text"
                        value={currentAddress}
                        onChange={(e) => setCurrentAddress(e.target.value)}
                        placeholder="VD: Thanh Khê, Đà Nẵng"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        TRƯỜNG HỌC
                      </label>
                      <input
                        type="text"
                        value={school}
                        onChange={(e) => setSchool(e.target.value)}
                        placeholder="VD: ĐH Kinh tế Đà Nẵng"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        CHUYÊN NGÀNH
                      </label>
                      <input
                        type="text"
                        value={major}
                        onChange={(e) => setMajor(e.target.value)}
                        placeholder="VD: Quản trị kinh doanh"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        VỊ TRÍ
                      </label>
                      <input
                        type="text"
                        value={positionTitle}
                        onChange={(e) => setPositionTitle(e.target.value)}
                        placeholder="VD: Nhân viên bán hàng"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        BỘ PHẬN *
                      </label>
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value as "OFFICE" | "SALES")}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-bold"
                      >
                        <option value="SALES">Bán hàng (Showroom)</option>
                        <option value="OFFICE">Văn phòng (Office)</option>
                      </select>
                    </div>
                  </div>

                  {/* Nhóm SỐ HĐ (HDTT / HĐTV / HDXDTH), BHXH (NGÀY ĐÓNG / MỨC ĐÓNG / NGÀY NGHỈ), Lương, Số ngày nghỉ, STK */}
                  <div className="p-3.5 rounded-xl bg-emerald-50/40 border border-emerald-200/70 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          LOẠI HỢP ĐỒNG *
                        </label>
                        <select
                          required={!isAdminView}
                          value={contractType}
                          onChange={(e) => setContractType(e.target.value as ContractType | "")}
                          className={`w-full px-3 py-2 rounded-lg border text-xs bg-white font-bold ${
                            contractType ? "border-slate-300" : "border-amber-400 text-slate-400"
                          }`}
                        >
                          <option value="" disabled>
                            -- Chọn loại hợp đồng --
                          </option>
                          {CONTRACT_TYPE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          SỐ HĐ — HDTT
                        </label>
                        <input
                          type="text"
                          value={internContractNumber}
                          onChange={(e) => setInternContractNumber(e.target.value)}
                          placeholder="Mã HDTT..."
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          SỐ HĐ — HĐTV
                        </label>
                        <input
                          type="text"
                          value={probationContractNumber}
                          onChange={(e) => setProbationContractNumber(e.target.value)}
                          placeholder="VD: HĐTV-001/2026"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          SỐ HĐ — HDXDTH
                        </label>
                        <input
                          type="text"
                          value={officialContractNumber}
                          onChange={(e) => setOfficialContractNumber(e.target.value)}
                          placeholder="Mã HDXDTH..."
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          BHXH — NGÀY ĐÓNG
                        </label>
                        <input
                          type="date"
                          value={bhxhStartDate}
                          onChange={(e) => setBhxhStartDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          BHXH — MỨC ĐÓNG
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatMoneyInput(insurance)}
                          onChange={(e) => setInsurance(String(parseMoneyInput(e.target.value) || ""))}
                          placeholder="VD: 5.300.000"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          BHXH — NGÀY NGHỈ
                        </label>
                        <input
                          type="date"
                          value={bhxhEndDate}
                          onChange={(e) => setBhxhEndDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          Lương
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatMoneyInput(baseSalary)}
                          onChange={(e) => setBaseSalary(String(parseMoneyInput(e.target.value) || ""))}
                          placeholder="VD: 7.500.000"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          Trợ cấp
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatMoneyInput(allowance)}
                          onChange={(e) => setAllowance(String(parseMoneyInput(e.target.value) || ""))}
                          placeholder="0"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          Thưởng
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatMoneyInput(bonus)}
                          onChange={(e) => setBonus(String(parseMoneyInput(e.target.value) || ""))}
                          placeholder="0"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          Số ngày nghỉ
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={recordedLeaveDays}
                          onChange={(e) => setRecordedLeaveDays(e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          STK
                        </label>
                        <input
                          type="text"
                          value={bankAccount}
                          onChange={(e) => setBankAccount(e.target.value)}
                          placeholder="VD: 1903686868 - Techcombank"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Hàng cuối: File hợp đồng đính kèm + Nút Tạo nhân viên */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-xs transition">
                  <Upload className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {contractFileName
                      ? "Đổi file hợp đồng đính kèm"
                      : "Đính kèm file hợp đồng (PDF / Ảnh / Word)"}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const url = await readFileAsDataUrl(f);
                        setContractFileUrl(url);
                        setContractFileName(f.name);
                      } catch (err: any) {
                        setStatusMsg({ type: "error", text: err?.message || "Lỗi đọc file" });
                      }
                      e.target.value = "";
                    }}
                  />
                </label>

                {contractFileName && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                    <FileText className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                    <span className="max-w-[200px] truncate">{contractFileName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setContractFileUrl("");
                        setContractFileName("");
                      }}
                      className="text-red-500 hover:text-red-700 ml-1"
                      title="Xóa file đã chọn"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="py-2.5 px-6 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                + Tạo Nhân Viên Mới
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Danh sách nhân viên */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
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
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value as "ALL" | "OFFICE" | "SALES")}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">Tất cả Khối</option>
            <option value="OFFICE">Khối Văn phòng</option>
            <option value="SALES">Khối Bán hàng</option>
          </select>

          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as "ALL" | UserRole)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">Tất cả Vai trò</option>
            <option value="SALES">SALES (Bán hàng)</option>
            <option value="HR">HR (Nhân sự)</option>
            <option value="ACCOUNTANT">ACCOUNTANT (Kế toán &amp; Kho)</option>
            <option value="MARKETING">MARKETING</option>
            <option value="ADMIN">ADMIN (Quản lý)</option>
          </select>

          <select
            value={filterContract}
            onChange={(e) => setFilterContract(e.target.value as "ALL" | ContractType)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">Tất cả Hợp đồng</option>
            <option value="FULLTIME">Chính thức</option>
            <option value="PROBATION">Thử việc</option>
            <option value="INTERN">Thực tập (Intern)</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "ALL" | "ACTIVE" | "LOCKED")}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">Tất cả Trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="LOCKED">Đã khóa</option>
          </select>

          <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
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
                  <ArrowUp className="w-3 h-3 text-emerald-600" />
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
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-white uppercase">
              <tr>
                <th
                  onClick={() => handleColumnSort("code")}
                  className="py-3 px-3.5 cursor-pointer hover:bg-slate-800 select-none whitespace-nowrap"
                >
                  <span className="inline-flex items-center gap-1">
                    Mã NV
                    {sortBy === "code" &&
                      (sortOrder === "asc" ? (
                        <ArrowUp className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-amber-400" />
                      ))}
                  </span>
                </th>
                <th
                  onClick={() => handleColumnSort("fullName")}
                  className="py-3 px-3.5 cursor-pointer hover:bg-slate-800 select-none"
                >
                  <span className="inline-flex items-center gap-1">
                    Họ và tên &amp; Liên hệ
                    {sortBy === "fullName" &&
                      (sortOrder === "asc" ? (
                        <ArrowUp className="w-3 h-3 text-emerald-400" />
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
                filteredStaffList.map((st) => {
                  const normalizedRole =
                    st.role === ("WAREHOUSE" as any) ? "ACCOUNTANT" : st.role;
                  const isTargetAdmin = normalizedRole === "ADMIN";
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
                          <div className="text-[11px] text-emerald-700 font-mono">
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
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
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
                        {!isAdminView && isTargetAdmin ? (
                          <span className="px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 font-mono font-bold text-xs text-emerald-800">
                            ADMIN (Quản lý)
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
                            {isAdminView && <option value="ADMIN">ADMIN (Quản lý)</option>}
                          </select>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="text-slate-800 font-bold">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] ${
                              st.contractType === "FULLTIME"
                                ? "bg-emerald-50 text-emerald-700"
                                : st.contractType === "INTERN"
                                  ? "bg-sky-50 text-sky-700"
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
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
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
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {st.status === "ACTIVE" ? "Đang hoạt động" : "Đã khóa"}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {!isAdminView ? (
                            !isTargetAdmin ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenProfileModal(st)}
                                  className="py-1.5 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs transition cursor-pointer"
                                >
                                  Sửa hồ sơ
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenResetPassword(st)}
                                  className="px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 cursor-pointer"
                                >
                                  <KeyRound className="w-3.5 h-3.5" /> Đổi mật khẩu
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                Tài khoản Quản lý
                              </span>
                            )
                          ) : (
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
                                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
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
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Xem trước & Chọn dòng khi file Excel có nhiều nhân viên */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-4">
          <div className="w-full max-w-6xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <div className="text-xs uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Import Nhanh Hồ Sơ Nhân Sự Từ Excel</span>
                </div>
                <h3 className="font-extrabold text-base text-white mt-0.5">
                  File: {importFileName} — Đọc được {importRows.length} nhân sự
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="text-slate-600">
                  Bấm <strong className="text-emerald-700">&ldquo;Điền vào form&rdquo;</strong> ở 1 dòng để đưa thông tin ra ngoài kiểm tra kỹ trước khi tạo, hoặc tích chọn nhiều dòng để{" "}
                  <strong className="text-slate-900">Tạo hàng loạt</strong>.
                </div>
                <div className="flex items-center gap-2">
                  <label className="font-bold text-slate-700">Mật khẩu mặc định khi tạo loạt:</label>
                  <input
                    type="text"
                    value={bulkPassword}
                    onChange={(e) => setBulkPassword(e.target.value)}
                    className="w-36 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-xs"
                  />
                </div>
              </div>

              {importModalError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{importModalError}</span>
                </div>
              )}

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
                    <tr className="border-b border-slate-200">
                      <th rowSpan={2} className="py-2 px-3 w-10 border-r border-slate-200">
                        <button
                          type="button"
                          onClick={() =>
                            setImportRows((prev) =>
                              prev.map((r) => ({ ...r, selected: !allModalSelected }))
                            )
                          }
                          className="text-slate-700 hover:text-emerald-700 cursor-pointer"
                          title="Chọn / Bỏ chọn tất cả"
                        >
                          {allModalSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">Username *</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">BẮT ĐẦU</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">KẾT THÚC</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">HỌ TÊN</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">NGÀY SINH</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">GIỚI TÍNH</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">QUỐC TỊCH</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">CMND</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">NGÀY CẤP</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">NƠI CẤP</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">ĐỊA CHỈ THƯỜNG CHÚ</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">ĐỊA CHỈ HIỆN TẠI</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">TRƯỜNG HỌC</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">CHUYÊN NGÀNH</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">VỊ TRÍ</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">LOẠI HỢP ĐỒNG</th>
                      <th colSpan={3} className="py-1.5 px-3 text-center border-r border-b border-slate-200 bg-slate-200/60">
                        SỐ HĐ
                      </th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">SDT</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">BỘ PHẬN</th>
                      <th colSpan={3} className="py-1.5 px-3 text-center border-r border-b border-slate-200 bg-slate-200/60">
                        BHXH
                      </th>
                      <th rowSpan={2} className="py-2 px-3 text-right border-r border-slate-200">Lương</th>
                      <th rowSpan={2} className="py-2 px-3 text-center border-r border-slate-200">Số ngày nghỉ</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200">STK</th>
                      <th rowSpan={2} className="py-2 px-3 text-right">Thao tác</th>
                    </tr>
                    <tr>
                      <th className="py-1.5 px-2.5 border-r border-slate-200 text-[10px]">HDTT</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-200 text-[10px]">HĐTV</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-200 text-[10px]">HDXDTH</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-200 text-[10px]">NGÀY ĐÓNG</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-200 text-[10px] text-right">MỨC ĐÓNG</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-200 text-[10px]">NGÀY NGHỈ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {importRows.map((r, idx) => (
                      <tr key={r.rowIndex} className={r.selected ? "bg-white" : "bg-slate-50/60 text-slate-400"}>
                        <td className="py-2.5 px-3">
                          <input
                            type="checkbox"
                            checked={r.selected}
                            onChange={(e) =>
                              setImportRows((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, selected: e.target.checked } : item
                                )
                              )
                            }
                            className="w-4 h-4 accent-emerald-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={r.usernameInput}
                            onChange={(e) =>
                              setImportRows((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, usernameInput: e.target.value } : item
                                )
                              )
                            }
                            className="w-28 px-2 py-1 rounded border border-slate-300 font-mono text-xs bg-white text-slate-900"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-mono">{r.contractStartDate || "—"}</td>
                        <td className="py-2.5 px-3 font-mono">{r.contractEndDate || "—"}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{r.fullName}</td>
                        <td className="py-2.5 px-3 font-mono">{r.dateOfBirth || "—"}</td>
                        <td className="py-2.5 px-3">{r.gender || "—"}</td>
                        <td className="py-2.5 px-3">{r.nationality || "Việt Nam"}</td>
                        <td className="py-2.5 px-3 font-mono">{r.citizenId || "—"}</td>
                        <td className="py-2.5 px-3 font-mono">{r.citizenIssueDate || "—"}</td>
                        <td className="py-2.5 px-3">{r.citizenIssuePlace || "—"}</td>
                        <td className="py-2.5 px-3 max-w-[180px] truncate" title={r.permanentAddress}>
                          {r.permanentAddress || "—"}
                        </td>
                        <td className="py-2.5 px-3 max-w-[180px] truncate" title={r.currentAddress}>
                          {r.currentAddress || "—"}
                        </td>
                        <td className="py-2.5 px-3">{r.school || "—"}</td>
                        <td className="py-2.5 px-3">{r.major || "—"}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{r.positionTitle || r.role}</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-700">{contractTypeLabel(r.contractType)}</td>
                        <td className="py-2.5 px-2.5 font-mono">{r.internContractNumber || "—"}</td>
                        <td className="py-2.5 px-2.5 font-mono">{r.probationContractNumber || "—"}</td>
                        <td className="py-2.5 px-2.5 font-mono">{r.officialContractNumber || "—"}</td>
                        <td className="py-2.5 px-3 font-mono">{r.phone || "—"}</td>
                        <td className="py-2.5 px-3">
                          {r.department === "OFFICE" ? "Văn phòng" : "Bán hàng"} ({r.role})
                        </td>
                        <td className="py-2.5 px-2.5 font-mono">{r.bhxhStartDate || "—"}</td>
                        <td className="py-2.5 px-2.5 text-right font-mono">
                          {r.insurance > 0 ? formatVND(r.insurance) : "—"}
                        </td>
                        <td className="py-2.5 px-2.5 font-mono">{r.bhxhEndDate || "—"}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {r.baseSalary ? formatVND(r.baseSalary) : "0đ"}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">{r.recordedLeaveDays ?? 0}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px]" title={r.bankAccount}>
                          {r.bankAccount || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              fillCreateFormFromImportRow(r, r.usernameInput);
                              setImportModalOpen(false);
                              setStatusMsg({
                                type: "success",
                                text: `Đã điền hồ sơ "${r.fullName}" vào form. Kiểm tra lại và bấm "+ Tạo Nhân Viên Mới"!`,
                              });
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs cursor-pointer"
                          >
                            Điền vào form
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs font-bold text-slate-600">
                Đã chọn: <strong className="text-emerald-700">{selectedModalCount}</strong> / {importRows.length} nhân sự
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={bulkCreating || selectedModalCount === 0}
                  onClick={handleBulkCreateFromModal}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold shadow inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {bulkCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {bulkCreating
                      ? "Đang tạo tài khoản..."
                      : `Tạo hàng loạt (${selectedModalCount} nhân viên)`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Đổi mật khẩu cho nhân viên */}
      {pwdTargetStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <h4 className="font-extrabold text-sm">
                  Đổi mật khẩu tài khoản: {pwdTargetStaff.username}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setPwdTargetStaff(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetStaffPassword} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div>
                  Nhân sự: <strong className="text-slate-900">{pwdTargetStaff.fullName}</strong>
                </div>
                <div>
                  Username: <span className="font-mono font-bold">{pwdTargetStaff.username}</span> · Vai trò:{" "}
                  <span className="font-mono font-bold text-emerald-700">{pwdTargetStaff.role}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Mật khẩu mới (Tối thiểu 4 ký tự) *
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={newStaffPassword}
                  onChange={(e) => setNewStaffPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Xác nhận mật khẩu mới *
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={confirmStaffPassword}
                  onChange={(e) => setConfirmStaffPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPwdTargetStaff(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={pwdSaving}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold shadow"
                >
                  {pwdSaving ? "Đang lưu..." : "Lưu mật khẩu mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chỉnh Sửa Chi Tiết Hồ Sơ Nhân Sự (Dành cho HR) */}
      {selectedStaffProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-4">
          <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider">
                  Chỉnh Sửa Hồ Sơ Nhân Sự ({selectedStaffProfile.code})
                </span>
                <h3 className="font-extrabold text-base text-white mt-0.5">
                  @{selectedStaffProfile.username} — {selectedStaffProfile.fullName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStaffProfile(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfileModal} className="p-6 space-y-5 text-xs overflow-y-auto">
              {/* Khối 1: Thông tin Cá nhân, CCCD & Học vấn */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                  1. Thông tin Cá nhân, CCCD, Địa chỉ &amp; Học vấn
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Họ và tên nhân viên *
                    </label>
                    <input
                      type="text"
                      required
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Ngày sinh</label>
                    <input
                      type="date"
                      value={editDateOfBirth}
                      onChange={(e) => setEditDateOfBirth(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Giới tính</label>
                      <select
                        value={editGender}
                        onChange={(e) => setEditGender(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold"
                      >
                        <option value="">-- Chọn --</option>
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Quốc tịch</label>
                      <input
                        type="text"
                        value={editNationality}
                        onChange={(e) => setEditNationality(e.target.value)}
                        placeholder="Việt Nam"
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">CMND / CCCD</label>
                    <input
                      type="text"
                      value={editCitizenId}
                      onChange={(e) => setEditCitizenId(e.target.value)}
                      placeholder="Số CCCD 12 số..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Ngày cấp CCCD</label>
                    <input
                      type="date"
                      value={editCitizenIssueDate}
                      onChange={(e) => setEditCitizenIssueDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nơi cấp CCCD</label>
                    <input
                      type="text"
                      value={editCitizenIssuePlace}
                      onChange={(e) => setEditCitizenIssuePlace(e.target.value)}
                      placeholder="Cục CS QLHC..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Số điện thoại</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Email liên hệ</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Email công ty</label>
                    <input
                      type="email"
                      value={editCompanyEmail}
                      onChange={(e) => setEditCompanyEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                    />
                  </div>

                  <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Địa chỉ thường trú
                      </label>
                      <input
                        type="text"
                        value={editPermanentAddress}
                        onChange={(e) => setEditPermanentAddress(e.target.value)}
                        placeholder="Nhập hộ khẩu / địa chỉ thường trú..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Địa chỉ hiện tại
                      </label>
                      <input
                        type="text"
                        value={editCurrentAddress}
                        onChange={(e) => setEditCurrentAddress(e.target.value)}
                        placeholder="Nhập chỗ ở hiện tại..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Trường học</label>
                    <input
                      type="text"
                      value={editSchool}
                      onChange={(e) => setEditSchool(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Chuyên ngành</label>
                    <input
                      type="text"
                      value={editMajor}
                      onChange={(e) => setEditMajor(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Số tài khoản ngân hàng (STK)
                    </label>
                    <input
                      type="text"
                      value={editBankAccount}
                      onChange={(e) => setEditBankAccount(e.target.value)}
                      placeholder="VD: 1903686868 - Techcombank"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Khối 2: Vị trí, Hợp đồng & Số HĐ */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                  2. Vị trí, Hợp đồng Lao động &amp; Số Hợp đồng (HDTT / HĐTV / HDXDTH)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Vị trí (Chức danh)
                    </label>
                    <input
                      type="text"
                      value={editPositionTitle}
                      onChange={(e) => setEditPositionTitle(e.target.value)}
                      placeholder="VD: Nhân viên bán hàng"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Bộ phận (Khối)
                    </label>
                    <select
                      value={editDepartment}
                      onChange={(e) => setEditDepartment(e.target.value as "OFFICE" | "SALES")}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-xs"
                    >
                      <option value="OFFICE">Khối Văn phòng</option>
                      <option value="SALES">Khối Bán hàng (Showroom)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Loại hợp đồng
                    </label>
                    <select
                      value={editContractType}
                      onChange={(e) => {
                        const nextType = e.target.value as ContractType;
                        setEditContractType(nextType);
                        if (
                          nextType === "FULLTIME" &&
                          selectedStaffProfile?.contractType === "PROBATION" &&
                          editProbationMonths === 0
                        ) {
                          setEditProbationMonths(2);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-xs"
                    >
                      {CONTRACT_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                      {editContractType === "PARTTIME" && (
                        <option value="PARTTIME">Bán thời gian (cũ – vui lòng chọn lại)</option>
                      )}
                    </select>
                  </div>

                  {(editContractType === "PROBATION" || editContractType === "FULLTIME") && (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Số tháng thử việc
                      </label>
                      <select
                        value={editProbationMonths}
                        onChange={(e) => setEditProbationMonths(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-xs"
                      >
                        <option value={0}>0 tháng (Vào thẳng chính thức)</option>
                        <option value={1}>1 tháng thử việc (+1 ngày phép khi lên Chính thức)</option>
                        <option value={2}>2 tháng thử việc (+2 ngày phép khi lên Chính thức)</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Ngày bắt đầu hợp đồng
                    </label>
                    <input
                      type="date"
                      value={editContractStart}
                      onChange={(e) => setEditContractStart(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Ngày kết thúc hợp đồng
                    </label>
                    <input
                      type="date"
                      value={editContractEnd}
                      onChange={(e) => setEditContractEnd(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Số HĐ Thực tập (HDTT)
                    </label>
                    <input
                      type="text"
                      value={editInternContractNo}
                      onChange={(e) => setEditInternContractNo(e.target.value)}
                      placeholder="Mã HDTT..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Số HĐ Thử việc (HĐTV)
                    </label>
                    <input
                      type="text"
                      value={editProbationContractNo}
                      onChange={(e) => setEditProbationContractNo(e.target.value)}
                      placeholder="Mã HĐTV..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Số HĐ Chính thức (HDXDTH)
                    </label>
                    <input
                      type="text"
                      value={editOfficialContractNo}
                      onChange={(e) => setEditOfficialContractNo(e.target.value)}
                      placeholder="Mã HDXDTH..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Khối 3: Lương, BHXH, Số ngày nghỉ & File hợp đồng */}
              <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-200/80 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">
                  3. Lương, BHXH, Số ngày nghỉ &amp; File Hợp đồng đính kèm
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Lương cơ bản (VNĐ)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatMoneyInput(editBaseSalary)}
                      onChange={(e) => setEditBaseSalary(parseMoneyInput(e.target.value))}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Trợ cấp (VNĐ)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatMoneyInput(editAllowance)}
                      onChange={(e) => setEditAllowance(parseMoneyInput(e.target.value))}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Thưởng (VNĐ)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatMoneyInput(editBonus)}
                      onChange={(e) => setEditBonus(parseMoneyInput(e.target.value))}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      BHXH — Ngày đóng
                    </label>
                    <input
                      type="date"
                      value={editBhxhStart}
                      onChange={(e) => setEditBhxhStart(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      BHXH — Mức đóng (VNĐ)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatMoneyInput(editInsurance)}
                      onChange={(e) => setEditInsurance(parseMoneyInput(e.target.value))}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      BHXH — Ngày nghỉ
                    </label>
                    <input
                      type="date"
                      value={editBhxhEnd}
                      onChange={(e) => setEditBhxhEnd(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Số ngày nghỉ (Hồ sơ)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={editRecordedLeaveDays}
                      onChange={(e) => setEditRecordedLeaveDays(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2 flex flex-wrap items-end gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition">
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {editContractFileUrl
                          ? "Thay thế file hợp đồng khác"
                          : "Import file hợp đồng lên"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          try {
                            const url = await readFileAsDataUrl(f);
                            setEditContractFileUrl(url);
                            setEditContractFileName(f.name);
                          } catch (err: any) {
                            setStatusMsg({
                              type: "error",
                              text: err?.message || "Lỗi đọc file hợp đồng",
                            });
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>

                    {editContractFileUrl && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewContractStaff({
                              fullName: editFullName || selectedStaffProfile.fullName,
                              fileName: editContractFileName || "Hop-dong-lao-dong",
                              fileUrl: editContractFileUrl,
                            })
                          }
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="max-w-[160px] truncate">
                            {editContractFileName || "Xem file hợp đồng"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditContractFileUrl("");
                            setEditContractFileName("");
                          }}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa file</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStaffProfile(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {profileSaving ? "Đang lưu..." : "Lưu thông tin nhân sự"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xem Trước / Tải Xuống File Hợp Đồng (Hỗ trợ PDF, DOCX, DOC, Ảnh) */}
      {previewContractStaff && (
        <ContractFilePreviewModal
          staffName={previewContractStaff.fullName}
          fileName={previewContractStaff.fileName}
          fileUrl={previewContractStaff.fileUrl}
          onClose={() => setPreviewContractStaff(null)}
        />
      )}
    </div>
  );
}
