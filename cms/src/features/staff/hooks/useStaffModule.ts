import React, { useState, useEffect, useMemo } from "react";
import { StaffUser, UserRole, ContractType, ParsedStaffImportRow } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { CONTRACT_TYPE_OPTIONS, contractTypeLabel, formatVND } from "@/shared/utils/format";
import { parseStaffImportFileApi } from "../api";
import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import { exportStaff, downloadStaffImportTemplate } from "../exports";
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
import ContractFilePreviewModal from "@/shared/ui/ContractFilePreviewModal";
import { formatMoneyInput, parseMoneyInput, toIsoDateSlice, EditableImportRow } from "../utils";

export interface StaffModuleProps {
  mode?: "ADMIN_LOCK_ONLY" | "HR_FULL";
  currentUser?: StaffUser | null;
}

export function useStaffModule({ mode = "HR_FULL", currentUser = null }: StaffModuleProps) {
  const isCeo = currentUser?.role === "CEO";
  const isAdminView = (mode === "ADMIN_LOCK_ONLY" || currentUser?.role === "ADMIN") && !isCeo;
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
      const normalizedRole = st.role;
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

  return {
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
    showExtendedCreate,
    setShowExtendedCreate,
    importingExcel,
    importModalOpen,
    setImportModalOpen,
    importFileName,
    importRows,
    setImportRows,
    bulkPassword,
    setBulkPassword,
    bulkCreating,
    importModalError,
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
    pwdTargetStaff,
    setPwdTargetStaff,
    newStaffPassword,
    setNewStaffPassword,
    confirmStaffPassword,
    setConfirmStaffPassword,
    pwdSaving,
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
    profileSaving,
    previewContractStaff,
    setPreviewContractStaff,
    statusMsg,
    setStatusMsg,
    readFileAsDataUrl,
    resetCreateForm,
    fillCreateFormFromImportRow,
    handleImportStaffExcel,
    handleBulkCreateFromModal,
    handleOpenProfileModal,
    handleSaveProfileModal,
    handleCreateStaff,
    handleUpdateStaff,
    handleOpenResetPassword,
    handleResetStaffPassword,
    hasActiveFilters,
    handleResetFilters,
    handleColumnSort,
    filteredStaffList,
    allModalSelected,
    selectedModalCount,
  };
}

export type StaffViewModel = ReturnType<typeof useStaffModule>;
