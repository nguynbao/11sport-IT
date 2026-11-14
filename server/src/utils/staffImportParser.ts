import { parseCsvTextToMatrix, parseXlsxBufferToMatrix } from './fileImportParser';
import { ContractType, StaffDepartment, StaffRole } from '../models/Staff';

export interface ParsedStaffImportRow {
  rowIndex: number;
  suggestedUsername: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  citizenId: string;
  citizenIssueDate: string;
  citizenIssuePlace: string;
  permanentAddress: string;
  currentAddress: string;
  school: string;
  major: string;
  positionTitle: string;
  role: Exclude<StaffRole, 'CEO' | 'ADMIN'>;
  department: StaffDepartment;
  contractType: Exclude<ContractType, 'PARTTIME'>;
  contractStartDate: string;
  contractEndDate: string;
  internContractNumber: string;
  probationContractNumber: string;
  officialContractNumber: string;
  phone: string;
  email: string;
  companyEmail: string;
  bhxhStartDate: string;
  insurance: number;
  bhxhEndDate: string;
  baseSalary: number;
  allowance: number;
  bonus: number;
  recordedLeaveDays: number;
  bankAccount: string;
}

type ColumnKey =
  | 'contractStartDate'
  | 'contractEndDate'
  | 'fullName'
  | 'dateOfBirth'
  | 'gender'
  | 'nationality'
  | 'citizenId'
  | 'citizenIssueDate'
  | 'citizenIssuePlace'
  | 'permanentAddress'
  | 'currentAddress'
  | 'school'
  | 'major'
  | 'positionTitle'
  | 'contractTypeRaw'
  | 'singleContractNumber'
  | 'internContractNumber'
  | 'probationContractNumber'
  | 'officialContractNumber'
  | 'phone'
  | 'departmentRaw'
  | 'bhxhStartDate'
  | 'insurance'
  | 'bhxhEndDate'
  | 'baseSalary'
  | 'allowance'
  | 'bonus'
  | 'recordedLeaveDays'
  | 'bankAccount'
  | 'email'
  | 'companyEmail'
  | 'username';

function stripAccentsUpper(input: string): string {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Chuẩn hóa ngày từ Excel serial number (VD: 45962), DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY -> YYYY-MM-DD
 */
export function parseExcelDateToIso(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';

  // 1. Excel serial date (khoảng 1927..2119 => 10000..80000)
  if (/^\d{5}(?:\.\d+)?$/.test(s)) {
    const serial = Math.floor(Number(s));
    if (serial >= 10000 && serial <= 80000) {
      const utcMs = Math.round((serial - 25569) * 86400 * 1000);
      const dt = new Date(utcMs);
      if (!Number.isNaN(dt.getTime())) {
        return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
      }
    }
  }

  // 2. YYYY-MM-DD hoặc YYYY/MM/DD
  const ymd = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]);
    const d = Number(ymd[3]);
    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${pad2(m)}-${pad2(d)}`;
    }
  }

  // 3. DD/MM/YYYY hoặc D/M/YYYY (hỗ trợ tự đổi nếu MM/DD/YYYY kiểu Mỹ khi p2 > 12)
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmy) {
    let d = Number(dmy[1]);
    let m = Number(dmy[2]);
    let y = Number(dmy[3]);
    if (y < 100) {
      y += y <= 40 ? 2000 : 1900;
    }
    if (m > 12 && d <= 12) {
      const tmp = d;
      d = m;
      m = tmp;
    }
    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${pad2(m)}-${pad2(d)}`;
    }
  }

  // 4. Chỉ ghi năm sinh 4 chữ số (VD: "2002")
  if (/^(19|20)\d{2}$/.test(s)) {
    return `${s}-01-01`;
  }

  return '';
}

export function parseMoneyCell(raw: string): number {
  const s = String(raw || '').trim();
  if (!s) return 0;

  // Hỗ trợ dạng "8tr", "8.5 triệu", "8,5tr"
  const trMatch = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/^(\d+(?:[.,]\d+)?)\s*(?:tr|trieu)\b/i);
  if (trMatch) {
    const num = parseFloat(trMatch[1].replace(',', '.'));
    return Number.isFinite(num) && num > 0 ? Math.round(num * 1_000_000) : 0;
  }

  // Số thực từ XML Excel (VD: "8000000" hoặc "8000000.0" / "8000000.50")
  if (/^\d+(?:\.\d{1,2})?$/.test(s)) {
    const n = Math.round(Number(s));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  // Loại bỏ phần thập phân .00 hoặc ,00 ở cuối khi có dấu phân cách hàng nghìn (VD: "5.300.000,00 ₫" hoặc "5,300,000.00 ₫")
  const withoutCurrency = s
    .replace(/[^\d.,]/g, '')
    .replace(/([.,]\d{3})+[.,]\d{1,2}$/, (m) => m.replace(/[.,]\d{1,2}$/, ''));

  // Dạng có dấu chấm/phẩy phân cách hàng nghìn (VD: "5.300.000 ₫", "7.500.000 ₫", "8,500,000 đ")
  const digits = withoutCurrency.replace(/[^\d]/g, '');
  if (!digits) return 0;
  const parsed = Number(digits);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

export function parseNonNegativeNumberCell(raw: string): number {
  const s = String(raw || '').trim().replace(',', '.');
  if (!s) return 0;
  const m = s.match(/\d+(?:\.\d+)?/);
  if (!m) return 0;
  const n = Number(m[0]);
  return Number.isFinite(n) && n >= 0 ? Number(n.toFixed(2)) : 0;
}

function normalizePhoneCell(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  let digits = s.replace(/[^\d+]/g, '');
  if (digits.startsWith('+84')) {
    digits = '0' + digits.slice(3);
  } else if (digits.startsWith('84') && digits.length === 11) {
    digits = '0' + digits.slice(2);
  }
  digits = digits.replace(/\D/g, '');
  // Phục hồi số 0 đầu bị mất khi lưu dạng Number trong Excel (VD: 905123456 -> 0905123456)
  if (digits.length === 9 && /^[35789]/.test(digits)) {
    return '0' + digits;
  }
  return digits || s;
}

function normalizeCitizenIdCell(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  // Trường hợp Excel xuất scientific notation trong CSV (nếu có)
  if (/^\d+(?:\.\d+)?e\+\d+$/i.test(s)) {
    const num = Number(s);
    if (Number.isFinite(num)) {
      const expanded = Math.round(num).toString();
      return expanded.length === 11 ? '0' + expanded : expanded;
    }
  }
  const digitsOnly = s.replace(/\s+/g, '');
  if (/^\d{11}$/.test(digitsOnly)) {
    // CCCD 12 số bị mất số 0 ở đầu trong Excel (VD: 48201001234 -> 048201001234)
    return '0' + digitsOnly;
  }
  return digitsOnly;
}

function normalizeGenderCell(raw: string): string {
  const norm = stripAccentsUpper(raw);
  if (!norm) return '';
  if (norm === 'NAM' || norm === 'M' || norm === 'MALE') return 'Nam';
  if (norm === 'NU' || norm === 'F' || norm === 'FEMALE') return 'Nữ';
  return String(raw).trim();
}

export function suggestUsernameFromFullName(
  fullName: string,
  usedUsernames: Set<string>
): string {
  const clean = String(fullName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();

  const parts = clean.split(/\s+/).filter(Boolean);
  let base = 'nhanvien';
  if (parts.length === 1) {
    base = parts[0];
  } else if (parts.length >= 2) {
    const givenName = parts[parts.length - 1];
    const initials = parts
      .slice(0, -1)
      .map((p) => p[0])
      .join('');
    base = `${givenName}${initials}`;
  }

  let candidate = base;
  let suffix = 2;
  while (usedUsernames.has(candidate)) {
    candidate = `${base}${suffix}`;
    suffix++;
  }
  usedUsernames.add(candidate);
  return candidate;
}

function inferRoleAndDepartment(
  positionRaw: string,
  departmentRaw: string
): {
  role: Exclude<StaffRole, 'CEO' | 'ADMIN'>;
  department: StaffDepartment;
} {
  const pos = stripAccentsUpper(positionRaw);
  const dept = stripAccentsUpper(departmentRaw);
  const combined = `${pos} ${dept}`.trim();

  let role: Exclude<StaffRole, 'CEO' | 'ADMIN'> = 'SALES';
  if (
    /\b(HR|NHAN SU|HCNS|HANH CHINH|TUYEN DUNG)\b/.test(combined)
  ) {
    role = 'HR';
  } else if (
    /\b(KE TOAN|ACCOUNTANT|THU KHO|QUAN LY KHO|KIEM KHO|TAI CHINH)\b/.test(combined)
  ) {
    role = 'ACCOUNTANT';
  } else if (
    /\b(MARKETING|MKT|CONTENT|TRUYEN THONG|DESIGN|THIET KE|MEDIA)\b/.test(combined)
  ) {
    role = 'MARKETING';
  } else {
    role = 'SALES';
  }

  let department: StaffDepartment = role === 'SALES' ? 'SALES' : 'OFFICE';
  if (/\b(BAN HANG|SALES|SALE|SHOWROOM|CUA HANG|TU VAN)\b/.test(dept)) {
    department = 'SALES';
  } else if (
    /\b(VAN PHONG|OFFICE|KE TOAN|NHAN SU|HR|HCNS|MARKETING|MKT|HANH CHINH)\b/.test(dept)
  ) {
    department = 'OFFICE';
  }

  return { role, department };
}

function inferContractType(
  contractTypeRaw: string,
  internNo: string,
  probationNo: string,
  officialNo: string,
  contractStartIso: string,
  contractEndIso: string
): Exclude<ContractType, 'PARTTIME'> {
  const norm = stripAccentsUpper(contractTypeRaw);
  if (
    norm.includes('CHINH THUC') ||
    norm.includes('XDTH') ||
    norm.includes('XAC DINH THOI HAN') ||
    norm.includes('KHONG XAC DINH') ||
    norm.includes('KXDTH') ||
    norm.includes('FULLTIME') ||
    norm.includes('HDLD')
  ) {
    return 'FULLTIME';
  }
  if (norm.includes('THUC TAP') || norm.includes('INTERN') || norm === 'HDTT') {
    return 'INTERN';
  }
  if (norm.includes('THU VIEC') || norm.includes('PROBATION') || norm === 'HDTV') {
    return 'PROBATION';
  }

  // Nếu cột Loại HĐ để trống -> suy luận theo cột Số HĐ nào có dữ liệu (ưu tiên HĐ mới nhất: HDXDTH -> HĐTV -> HDTT)
  if (officialNo) return 'FULLTIME';
  if (probationNo) return 'PROBATION';
  if (internNo) return 'INTERN';

  // Nếu có cả ngày bắt đầu & kết thúc cách nhau > 65 ngày thì suy luận là HĐ Chính thức
  if (contractStartIso && contractEndIso) {
    const diffDays = Math.round(
      (new Date(contractEndIso).getTime() - new Date(contractStartIso).getTime()) / 86400000
    );
    if (diffDays > 65) return 'FULLTIME';
  }

  return 'PROBATION';
}

function matchTopHeaderKey(norm: string): ColumnKey | null {
  if (!norm) return null;
  if (norm === 'BAT DAU' || norm === 'NGAY BAT DAU' || norm === 'NGAY VAO LAM' || norm === 'NGAY NHAN VIEC') {
    return 'contractStartDate';
  }
  if (norm === 'KET THUC' || norm === 'NGAY KET THUC' || norm === 'NGAY HET HAN' || norm === 'NGAY NGHI VIEC') {
    return 'contractEndDate';
  }
  if (norm === 'HO TEN' || norm === 'HO VA TEN' || norm === 'TEN NHAN VIEN' || norm === 'HO TEN NHAN VIEN') {
    return 'fullName';
  }
  if (norm === 'NGAY SINH' || norm === 'NAM SINH' || norm === 'SINH NGAY' || norm === 'DOB') {
    return 'dateOfBirth';
  }
  if (norm === 'GIOI TINH') return 'gender';
  if (norm === 'QUOC TICH') return 'nationality';
  if (
    norm === 'CMND' ||
    norm === 'CCCD' ||
    norm === 'SO CMND' ||
    norm === 'SO CCCD' ||
    norm === 'CMND CCCD' ||
    norm === 'CCCD CMND'
  ) {
    return 'citizenId';
  }
  if (norm === 'NGAY CAP' || norm === 'NGAY CAP CCCD' || norm === 'NGAY CAP CMND') {
    return 'citizenIssueDate';
  }
  if (norm === 'NOI CAP' || norm === 'NOI CAP CCCD' || norm === 'NOI CAP CMND') {
    return 'citizenIssuePlace';
  }
  if (
    norm.includes('THUONG CHU') ||
    norm.includes('THUONG TRU') ||
    norm === 'HO KHAU' ||
    norm === 'DIA CHI'
  ) {
    return 'permanentAddress';
  }
  if (
    norm.includes('DIA CHI HIEN TAI') ||
    norm.includes('CHO O HIEN TAI') ||
    norm.includes('NOI O HIEN TAI') ||
    norm === 'TAM TRU'
  ) {
    return 'currentAddress';
  }
  if (norm === 'TRUONG HOC' || norm === 'TRUONG' || norm === 'TRUONG DAO TAO') {
    return 'school';
  }
  if (norm === 'CHUYEN NGANH' || norm === 'NGANH HOC' || norm === 'NGANH') {
    return 'major';
  }
  if (norm === 'VI TRI' || norm === 'CHUC VU' || norm === 'CHUC DANH') {
    return 'positionTitle';
  }
  if (norm === 'LOAI HOP DONG' || norm === 'LOAI HD') {
    return 'contractTypeRaw';
  }
  if (norm === 'HDTT' || norm === 'SO HDTT') return 'internContractNumber';
  if (norm === 'HDTV' || norm === 'SO HDTV') return 'probationContractNumber';
  if (norm === 'HDXDTH' || norm === 'SO HDXDTH') return 'officialContractNumber';
  if (norm === 'SO HD' || norm === 'SO HOP DONG') {
    return 'singleContractNumber';
  }
  if (
    norm === 'SDT' ||
    norm === 'SO DIEN THOAI' ||
    norm === 'DIEN THOAI' ||
    norm === 'SO DT' ||
    norm === 'PHONE'
  ) {
    return 'phone';
  }
  if (norm === 'BO PHAN' || norm === 'PHONG BAN' || norm === 'KHOI') {
    return 'departmentRaw';
  }
  if (norm === 'NGAY DONG BHXH') return 'bhxhStartDate';
  if (norm === 'MUC DONG BHXH' || norm === 'BAO HIEM') return 'insurance';
  if (norm === 'NGAY NGHI BHXH') return 'bhxhEndDate';
  if (norm === 'LUONG' || norm === 'LUONG CO BAN' || norm === 'MUC LUONG') {
    return 'baseSalary';
  }
  if (norm === 'TRO CAP' || norm === 'PHU CAP') return 'allowance';
  if (norm === 'THUONG') return 'bonus';
  if (norm === 'SO NGAY NGHI' || norm === 'SO NGAY PHEP' || norm === 'NGAY PHEP') {
    return 'recordedLeaveDays';
  }
  if (
    norm === 'STK' ||
    norm === 'SO TAI KHOAN' ||
    norm.includes('TAI KHOAN NGAN HANG') ||
    norm === 'SO TK'
  ) {
    return 'bankAccount';
  }
  if (norm === 'EMAIL' || norm === 'EMAIL LIEN HE' || norm === 'EMAIL CA NHAN') {
    return 'email';
  }
  if (norm === 'EMAIL CONG TY') return 'companyEmail';
  if (norm === 'USERNAME' || norm === 'TEN DANG NHAP') return 'username';
  return null;
}

function matchSubHeaderKey(subNorm: string, activeGroupNorm: string): ColumnKey | null {
  if (!subNorm) return null;
  if (subNorm === 'HDTT' || subNorm.includes('THUC TAP')) return 'internContractNumber';
  if (subNorm === 'HDTV' || subNorm.includes('THU VIEC')) return 'probationContractNumber';
  if (subNorm === 'HDXDTH' || subNorm === 'HDKXDTH' || subNorm.includes('XDTH') || subNorm.includes('CHINH THUC')) {
    return 'officialContractNumber';
  }
  if (subNorm === 'NGAY DONG' || (activeGroupNorm.includes('BHXH') && subNorm.includes('DONG') && subNorm.includes('NGAY'))) {
    return 'bhxhStartDate';
  }
  if (subNorm === 'MUC DONG' || (activeGroupNorm.includes('BHXH') && subNorm.includes('MUC'))) {
    return 'insurance';
  }
  if (
    subNorm === 'NGAY NGHI' ||
    (activeGroupNorm.includes('BHXH') && subNorm.includes('NGAY NGHI') && !subNorm.includes('SO NGAY'))
  ) {
    return 'bhxhEndDate';
  }
  return null;
}

const TEMPLATE_26_COLS: ColumnKey[] = [
  'contractStartDate', // 0: BẮT ĐẦU
  'contractEndDate', // 1: KẾT THÚC
  'fullName', // 2: HỌ TÊN
  'dateOfBirth', // 3: NGÀY SINH
  'gender', // 4: GIỚI TÍNH
  'nationality', // 5: QUỐC TỊCH
  'citizenId', // 6: CMND
  'citizenIssueDate', // 7: NGÀY CẤP
  'citizenIssuePlace', // 8: NƠI CẤP
  'permanentAddress', // 9: ĐỊA CHỈ THƯỜNG CHÚ
  'currentAddress', // 10: ĐỊA CHỈ HIỆN TẠI
  'school', // 11: TRƯỜNG HỌC
  'major', // 12: CHUYÊN NGÀNH
  'positionTitle', // 13: VỊ TRÍ
  'contractTypeRaw', // 14: LOẠI HỢP ĐỒNG
  'internContractNumber', // 15: SỐ HĐ -> HDTT
  'probationContractNumber', // 16: SỐ HĐ -> HĐTV
  'officialContractNumber', // 17: SỐ HĐ -> HDXDTH
  'phone', // 18: SDT
  'departmentRaw', // 19: BỘ PHẬN
  'bhxhStartDate', // 20: BHXH -> NGÀY ĐÓNG
  'insurance', // 21: BHXH -> MỨC ĐÓNG
  'bhxhEndDate', // 22: BHXH -> NGÀY NGHỈ
  'baseSalary', // 23: Lương
  'recordedLeaveDays', // 24: Số ngày nghỉ
  'bankAccount', // 25: STK
];

/**
 * Bóc tách ma trận 2 chiều từ Excel / CSV theo mẫu hồ sơ nhân sự của HR.
 */
export function parseStaffImportMatrix(
  matrix: string[][],
  existingUsernames: string[] = []
): ParsedStaffImportRow[] {
  if (!Array.isArray(matrix) || matrix.length === 0) return [];

  const usedUsernames = new Set(existingUsernames.map((u) => String(u || '').trim().toLowerCase()).filter(Boolean));

  // 1. Tìm dòng header chính (chứa ít nhất 3 cột tiêu đề nhân sự chuẩn)
  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(matrix.length, 15); r++) {
    const row = matrix[r] || [];
    let score = 0;
    for (const cell of row) {
      const k = matchTopHeaderKey(stripAccentsUpper(cell));
      if (k) score++;
    }
    if (score >= 3) {
      headerRowIdx = r;
      break;
    }
  }

  if (headerRowIdx === -1) {
    return [];
  }

  const topRow = matrix[headerRowIdx] || [];
  const nextRow = matrix[headerRowIdx + 1] || [];

  // 2. Kiểm tra dòng kế tiếp có phải dòng sub-header gộp ô (HDTT, HĐTV, HDXDTH, NGÀY ĐÓNG, MỨC ĐÓNG, NGÀY NGHỈ) không
  let subHeaderHits = 0;
  for (const cell of nextRow) {
    const subNorm = stripAccentsUpper(cell);
    if (
      subNorm === 'HDTT' ||
      subNorm === 'HDTV' ||
      subNorm === 'HDXDTH' ||
      subNorm === 'NGAY DONG' ||
      subNorm === 'MUC DONG' ||
      subNorm === 'NGAY NGHI'
    ) {
      subHeaderHits++;
    }
  }
  const hasSubHeaderRow = subHeaderHits >= 1;
  const dataStartIdx = hasSubHeaderRow ? headerRowIdx + 2 : headerRowIdx + 1;

  // 3. Lập bản đồ cột colIndex -> ColumnKey
  const maxCols = Math.max(topRow.length, hasSubHeaderRow ? nextRow.length : 0);
  const colMap = new Map<number, ColumnKey>();
  let activeGroup = '';

  for (let c = 0; c < maxCols; c++) {
    const topNorm = stripAccentsUpper(topRow[c] || '');
    const subNorm = hasSubHeaderRow ? stripAccentsUpper(nextRow[c] || '') : '';

    if (topNorm) {
      activeGroup = topNorm;
    } else if (!subNorm) {
      activeGroup = '';
    }

    const subMatched = hasSubHeaderRow ? matchSubHeaderKey(subNorm, activeGroup) : null;
    if (subMatched) {
      colMap.set(c, subMatched);
      continue;
    }

    const topMatched = matchTopHeaderKey(topNorm) || (hasSubHeaderRow ? matchTopHeaderKey(subNorm) : null);
    if (topMatched) {
      activeGroup = topNorm || subNorm;
      colMap.set(c, topMatched);
    }
  }

  // Nếu là đúng mẫu 26 cột 2 dòng tiêu đề của HR mà có ô bị trống tiêu đề phụ khi xuất từ Excel, điền khuyết theo vị trí chuẩn 26 cột
  if (hasSubHeaderRow && maxCols >= 26 && colMap.get(0) === 'contractStartDate' && colMap.get(2) === 'fullName') {
    const mappedValues = new Set(colMap.values());
    for (let c = 0; c < TEMPLATE_26_COLS.length; c++) {
      const targetKey = TEMPLATE_26_COLS[c];
      if (!colMap.has(c) && !mappedValues.has(targetKey)) {
        colMap.set(c, targetKey);
        mappedValues.add(targetKey);
      }
    }
  }

  // 4. Đọc từng dòng dữ liệu nhân sự
  const results: ParsedStaffImportRow[] = [];

  for (let r = dataStartIdx; r < matrix.length; r++) {
    const row = matrix[r] || [];
    const getVal = (key: ColumnKey): string => {
      for (const [colIdx, mappedKey] of colMap.entries()) {
        if (mappedKey === key) {
          return String(row[colIdx] ?? '').trim();
        }
      }
      return '';
    };

    const fullName = getVal('fullName');
    const citizenId = normalizeCitizenIdCell(getVal('citizenId'));
    const phone = normalizePhoneCell(getVal('phone'));

    // Bỏ qua dòng trống hoặc dòng ghi chú/tổng cộng không có Họ tên
    if (!fullName) continue;
    const normName = stripAccentsUpper(fullName);
    if (normName === 'HO TEN' || normName === 'TONG CONG' || normName === 'TONG') continue;

    let internContractNumber = getVal('internContractNumber');
    let probationContractNumber = getVal('probationContractNumber');
    let officialContractNumber = getVal('officialContractNumber');
    const singleContractNo = getVal('singleContractNumber');

    const contractStartDate = parseExcelDateToIso(getVal('contractStartDate'));
    const contractEndDate = parseExcelDateToIso(getVal('contractEndDate'));

    const contractType = inferContractType(
      getVal('contractTypeRaw'),
      internContractNumber,
      probationContractNumber,
      officialContractNumber,
      contractStartDate,
      contractEndDate
    );

    if (singleContractNo && !internContractNumber && !probationContractNumber && !officialContractNumber) {
      if (contractType === 'INTERN') internContractNumber = singleContractNo;
      else if (contractType === 'FULLTIME') officialContractNumber = singleContractNo;
      else probationContractNumber = singleContractNo;
    }

    const positionTitle = getVal('positionTitle');
    const { role, department } = inferRoleAndDepartment(positionTitle, getVal('departmentRaw'));

    const explicitUsername = getVal('username')
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '');
    let suggestedUsername = '';
    if (explicitUsername && !usedUsernames.has(explicitUsername)) {
      usedUsernames.add(explicitUsername);
      suggestedUsername = explicitUsername;
    } else {
      suggestedUsername = suggestUsernameFromFullName(fullName, usedUsernames);
    }

    results.push({
      rowIndex: r + 1,
      suggestedUsername,
      fullName,
      dateOfBirth: parseExcelDateToIso(getVal('dateOfBirth')),
      gender: normalizeGenderCell(getVal('gender')),
      nationality: getVal('nationality') || 'Việt Nam',
      citizenId,
      citizenIssueDate: parseExcelDateToIso(getVal('citizenIssueDate')),
      citizenIssuePlace: getVal('citizenIssuePlace'),
      permanentAddress: getVal('permanentAddress'),
      currentAddress: getVal('currentAddress'),
      school: getVal('school'),
      major: getVal('major'),
      positionTitle,
      role,
      department,
      contractType,
      contractStartDate,
      contractEndDate,
      internContractNumber,
      probationContractNumber,
      officialContractNumber,
      phone,
      email: getVal('email'),
      companyEmail: getVal('companyEmail'),
      bhxhStartDate: parseExcelDateToIso(getVal('bhxhStartDate')),
      insurance: parseMoneyCell(getVal('insurance')),
      bhxhEndDate: parseExcelDateToIso(getVal('bhxhEndDate')),
      baseSalary: parseMoneyCell(getVal('baseSalary')),
      allowance: parseMoneyCell(getVal('allowance')),
      bonus: parseMoneyCell(getVal('bonus')),
      recordedLeaveDays: parseNonNegativeNumberCell(getVal('recordedLeaveDays')),
      bankAccount: getVal('bankAccount'),
    });
  }

  return results;
}

export function parseStaffImportFile(params: {
  fileName?: string;
  fileBase64?: string;
  csvText?: string;
  existingUsernames?: string[];
}): ParsedStaffImportRow[] {
  const { fileName = '', fileBase64 = '', csvText = '', existingUsernames = [] } = params;
  const ext = String(fileName).trim().toLowerCase();

  if (csvText && String(csvText).trim()) {
    const matrix = parseCsvTextToMatrix(csvText);
    return parseStaffImportMatrix(matrix, existingUsernames);
  }

  if (!fileBase64) return [];
  const cleanBase64 = String(fileBase64).replace(/^data:[^;]+;base64,/, '').trim();
  if (!cleanBase64) return [];
  const buffer = Buffer.from(cleanBase64, 'base64');

  if (ext.endsWith('.csv') || ext.endsWith('.tsv') || ext.endsWith('.txt')) {
    const text = buffer.toString('utf8');
    return parseStaffImportMatrix(parseCsvTextToMatrix(text), existingUsernames);
  }

  // Mặc định thử giải nén .xlsx trước; nếu không phải zip .xlsx (VD file .csv đổi đuôi .xls) thì fallback sang text CSV/TSV
  const xlsxMatrix = parseXlsxBufferToMatrix(buffer);
  if (xlsxMatrix.length > 0) {
    return parseStaffImportMatrix(xlsxMatrix, existingUsernames);
  }

  const fallbackText = buffer.toString('utf8');
  return parseStaffImportMatrix(parseCsvTextToMatrix(fallbackText), existingUsernames);
}
