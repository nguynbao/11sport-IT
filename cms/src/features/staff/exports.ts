import type { StaffUser } from "@/shared/types";
import { ROLE_LABELS as ROLE } from "@/shared/lib/exportLabels";
import { buildSheet, downloadExcel, excelFileName, ExcelColumn, toDate } from "@/shared/lib/excel";

/* ------------------------------- Nhân viên ------------------------------- */

export function exportStaff(staff: StaffUser[]) {
  const cols: ExcelColumn<StaffUser>[] = [
    { header: "Mã NV", value: (s) => s.code },
    { header: "Username", value: (s) => s.username },
    { header: "Bắt đầu", value: (s) => toDate(s.contractStartDate), format: "date", width: 13 },
    { header: "Kết thúc", value: (s) => toDate(s.contractEndDate), format: "date", width: 13 },
    { header: "Họ và tên", value: (s) => s.fullName, width: 28 },
    { header: "Ngày sinh", value: (s) => toDate(s.dateOfBirth), format: "date", width: 13 },
    { header: "Giới tính", value: (s) => s.gender || "", width: 10 },
    { header: "Quốc tịch", value: (s) => s.nationality || "", width: 12 },
    { header: "CCCD / CMND", value: (s) => s.citizenId || "", width: 15 },
    { header: "Ngày cấp", value: (s) => toDate(s.citizenIssueDate), format: "date", width: 13 },
    { header: "Nơi cấp", value: (s) => s.citizenIssuePlace || "", width: 22 },
    { header: "Địa chỉ thường trú", value: (s) => s.permanentAddress || s.address || "", width: 32 },
    { header: "Địa chỉ hiện tại", value: (s) => s.currentAddress || "", width: 32 },
    { header: "Trường học", value: (s) => s.school || "", width: 24 },
    { header: "Chuyên ngành", value: (s) => s.major || "", width: 22 },
    { header: "Vị trí", value: (s) => s.positionTitle || "", width: 20 },
    {
      header: "Loại hợp đồng",
      value: (s) =>
        s.contractType === "FULLTIME"
          ? "Chính thức"
          : s.contractType === "INTERN"
            ? "Thực tập"
            : s.contractType === "PROBATION"
              ? "Thử việc"
              : s.contractType || "",
    },
    { header: "Số HĐTT", value: (s) => s.internContractNumber || "", width: 16 },
    { header: "Số HĐTV", value: (s) => s.probationContractNumber || "", width: 16 },
    { header: "Số HĐXĐTH", value: (s) => s.officialContractNumber || "", width: 16 },
    { header: "SĐT", value: (s) => s.phone || "", width: 14 },
    { header: "Email liên hệ", value: (s) => s.email || "", width: 24 },
    { header: "Email công ty", value: (s) => s.companyEmail || "", width: 24 },
    { header: "Bộ phận / Khối", value: (s) => (s.department === "OFFICE" ? "Văn phòng" : "Bán hàng") },
    { header: "Phân quyền", value: (s) => ROLE[s.role] || s.role },
    { header: "BHXH Ngày đóng", value: (s) => toDate(s.bhxhStartDate), format: "date", width: 14 },
    { header: "BHXH Mức đóng", value: (s) => Number(s.insurance || 0), format: "money", total: true, width: 16 },
    { header: "BHXH Ngày nghỉ", value: (s) => toDate(s.bhxhEndDate), format: "date", width: 14 },
    { header: "Lương cơ bản", value: (s) => Number(s.baseSalary || 0), format: "money", total: true, width: 16 },
    { header: "Trợ cấp", value: (s) => Number(s.allowance || 0), format: "money", total: true, width: 15 },
    { header: "Thưởng", value: (s) => Number(s.bonus || 0), format: "money", total: true, width: 15 },
    { header: "Số ngày nghỉ", value: (s) => Number(s.recordedLeaveDays || 0), width: 13 },
    { header: "STK ngân hàng", value: (s) => s.bankAccount || "", width: 24 },
    { header: "Trạng thái", value: (s) => (s.status === "ACTIVE" ? "Đang hoạt động" : "Đã khóa") },
    { header: "Ngày tạo", value: (s) => toDate(s.createdAt), format: "datetime", width: 17 },
  ];
  downloadExcel(excelFileName("NhanVien"), [
    buildSheet("Nhan vien", cols, staff, { title: "DANH SÁCH NHÂN VIÊN" }),
  ]);
}

export function downloadStaffImportTemplate(): void {
  const row1 = [
    "BẮT ĐẦU",
    "KẾT THÚC",
    "HỌ TÊN",
    "NGÀY SINH",
    "GIỚI TÍNH",
    "QUỐC TỊCH",
    "CMND",
    "NGÀY CẤP",
    "NƠI CẤP",
    "ĐỊA CHỈ THƯỜNG CHÚ",
    "ĐỊA CHỈ HIỆN TẠI",
    "TRƯỜNG HỌC",
    "CHUYÊN NGÀNH",
    "VỊ TRÍ",
    "LOẠI HỢP ĐỒNG",
    "SỐ HĐ",
    "",
    "",
    "SDT",
    "BỘ PHẬN",
    "BHXH",
    "",
    "",
    "Lương",
    "Số ngày nghỉ",
    "STK",
  ];
  const row2 = [
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "HDTT",
    "HĐTV",
    "HDXDTH",
    "",
    "",
    "NGÀY ĐÓNG",
    "MỨC ĐÓNG",
    "NGÀY NGHỈ",
    "",
    "",
    "",
  ];
  const sampleRow = [
    "01/11/2026",
    "31/12/2026",
    "Nguyễn Văn Mẫu",
    "15/08/2001",
    "Nam",
    "Việt Nam",
    "48201001234",
    "10/05/2022",
    "Cục CS QLHC về TTXH",
    "Hải Châu, Đà Nẵng",
    "Thanh Khê, Đà Nẵng",
    "ĐH Kinh tế Đà Nẵng",
    "Quản trị kinh doanh",
    "Nhân viên bán hàng",
    "Thử việc",
    "",
    "HĐTV-001/2026",
    "",
    "905123456",
    "Bán hàng",
    "01/11/2026",
    "5.300.000 ₫",
    "",
    "7.500.000 ₫",
    "0",
    "1903686868 - Techcombank",
  ];

  const escapeCsvCell = (v: string) => {
    const clean = v.trim();
    if (clean.includes(",") || clean.includes('"') || clean.includes("\n")) {
      return `"${clean.replace(/"/g, '""')}"`;
    }
    return clean;
  };

  const csvContent =
    "\uFEFF" +
    [row1, row2, sampleRow].map((r) => r.map(escapeCsvCell).join(",")).join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Mau_Import_Ho_So_Nhan_Su_11Sport.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

