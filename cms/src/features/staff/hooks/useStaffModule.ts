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
import { buildStaffImportActions } from "./staffImportHelper";
import { buildStaffActions } from "./staffActionsHelper";

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

  const staffCtx = {
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
  };
  const {
    fillCreateFormFromImportRow,
    handleImportStaffExcel,
    handleBulkCreateFromModal,
  } = buildStaffImportActions(staffCtx);
  const {
    handleOpenProfileModal,
    handleSaveProfileModal,
    handleCreateStaff,
    handleUpdateStaff,
    handleOpenResetPassword,
    handleResetStaffPassword,
  } = buildStaffActions(staffCtx);

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
    ...staffCtx,
    showExtendedCreate,
    importingExcel,
    importModalOpen,
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
    pwdSaving,
    profileSaving,
    previewContractStaff,
    setPreviewContractStaff,
    statusMsg,
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
